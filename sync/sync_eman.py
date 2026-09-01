"""Sync the selected Eman catalog into Supabase.

Eman is the source of truth for:
- SKU / article
- product name
- price
- base brand
- category
- images
- stock quantity
- stock locations

YECHIM-only fields stay in Supabase table yechim_enrichment
and are never overwritten here.

The job is designed for GitHub Actions at
06:00 Asia/Tashkent (01:00 UTC).
"""

from __future__ import annotations

import html as html_module
import json
import os
import re
import time

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


# =========================================================
# CONFIG
# =========================================================

BASE = 'https://www.eman.uz'
HOME = f'{BASE}/ru/'

HEADERS = {
    'User-Agent':
        'YECHIM-Catalog-Sync/1.0 '
        '(+https://github.com/yechimmaterials/yechim-catalog)'
}

OUT = (
    Path(__file__).resolve().parents[1]
    / 'data'
    / 'products.json'
)


# =========================================================
# PRODUCT MODEL
# =========================================================

@dataclass
class Product:

    eman_id: str
    source_url: str

    # Article / SKU from Eman
    sku: str

    name: str
    brand: str

    eman_group: str
    category: str

    price: float | int
    currency: str

    image_url: str

    # Total stock from all Eman warehouses
    stock_quantity: float | int | None

    # Stock unit
    stock_unit: str

    # Additional source information
    extra: dict


# =========================================================
# HTTP SESSION
# =========================================================

session = requests.Session()

session.headers.update(
    HEADERS
)


# =========================================================
# HELPERS
# =========================================================

def clean(
    value: str
) -> str:

    return re.sub(
        r'\s+',
        ' ',
        (value or '')
            .replace(
                '\xa0',
                ' '
            )
    ).strip()


def to_number(
    value: str
):

    if value is None:
        return 0

    value = str(value)

    value = value.replace(
        '\xa0',
        ' '
    )

    value = value.strip()

    # Remove thousands separators but keep decimal point.
    digits = re.sub(
        r'[^0-9.]',
        '',
        value
    )

    try:

        if not digits:
            return 0

        return (
            float(digits)
            if '.' in digits
            else int(digits)
        )

    except ValueError:

        return 0


def absolute(
    url: str,
    base: str = BASE
) -> str:

    return urljoin(
        base,
        url or ''
    )


def soup(
    url: str
) -> BeautifulSoup:

    response = session.get(
        url,
        timeout=40
    )

    response.raise_for_status()

    return BeautifulSoup(
        response.text,
        'html.parser'
    )


# =========================================================
# ARTICLE / SKU
# =========================================================

def extract_article(
    page: BeautifulSoup
) -> str:

    """
    Extract the visible Eman article.

    Examples:

        Артикул 15.0047
        Артикул: 15.0047
        Артикул A4195016111
    """

    article_pattern = re.compile(
        r'\bартикул\b\s*'
        r'[:№#-]?\s*'
        r'([A-Za-zА-Яа-я0-9]'
        r'[A-Za-zА-Яа-я0-9._/-]*)',
        re.I
    )


    # -----------------------------------------------------
    # 1. Search visible page text
    # -----------------------------------------------------

    for node in page.find_all(
        string=re.compile(
            r'\bартикул\b',
            re.I
        )
    ):

        parent = node.parent

        if not parent:
            continue


        candidates = [

            clean(
                parent.get_text(
                    ' ',
                    strip=True
                )
            ),

            (
                clean(
                    parent.parent.get_text(
                        ' ',
                        strip=True
                    )
                )
                if parent.parent
                else ''
            )

        ]


        for candidate in candidates:

            match = article_pattern.search(
                candidate
            )

            if match:

                return clean(
                    match.group(1)
                )


        container = parent.parent

        if container:

            container_text = clean(
                container.get_text(
                    ' ',
                    strip=True
                )
            )


            match = article_pattern.search(
                container_text
            )


            if match:

                return clean(
                    match.group(1)
                )


    # -----------------------------------------------------
    # 2. Structured HTML fallback
    # -----------------------------------------------------

    selectors = (
        '[itemprop="sku"]',
        '[data-article]',
        '[data-sku]'
    )


    for selector in selectors:

        node = page.select_one(
            selector
        )

        if not node:
            continue


        value = clean(
            node.get('content')
            or node.get('data-article')
            or node.get('data-sku')
            or node.get_text(
                ' ',
                strip=True
            )
        )


        if value:

            return value


    return ''


# =========================================================
# STOCK / WAREHOUSES
# =========================================================

def extract_stock(
    page: BeautifulSoup
) -> tuple[
    float | int | None,
    str,
    list[dict]
]:

    """
    Extract warehouse stock from the Eman product page.

    Eman currently displays stock approximately as:

        В наличии

        Chinobod 60
        Jagban 25
        Корасув 10
        Рахимова 16

        Характеристики

    The code intentionally does NOT hard-code warehouse names.
    It looks for quantity rows between the "В наличии" and
    "Характеристики" sections.

    Returns:

        total_quantity
        stock_unit
        stock_locations

    Example:

        (
            111,
            'шт.',
            [
                {
                    'name': 'Chinobod',
                    'quantity': 60
                },
                {
                    'name': 'Jagban',
                    'quantity': 25
                },
                {
                    'name': 'Корасув',
                    'quantity': 10
                },
                {
                    'name': 'Рахимова',
                    'quantity': 16
                }
            ]
        )
    """


    # -----------------------------------------------------
    # Build clean visible text fragments
    # -----------------------------------------------------

    fragments = []

    for fragment in page.stripped_strings:

        value = clean(
            fragment
        )

        if value:
            fragments.append(
                value
            )


    if not fragments:

        return (
            None,
            '',
            []
        )


    # -----------------------------------------------------
    # Locate stock section
    # -----------------------------------------------------

    start_index = None
    end_index = None


    for index, fragment in enumerate(
        fragments
    ):

        if re.fullmatch(
            r'в\s+наличии',
            fragment,
            re.I
        ):

            start_index = index + 1
            break


    if start_index is None:

        return (
            None,
            '',
            []
        )


    # -----------------------------------------------------
    # Locate the next logical section
    # -----------------------------------------------------

    section_end_patterns = (
        r'^характеристики$',
        r'^описание$',
        r'^рекомендуем',
        r'^комментарии$',
        r'^оставить отзыв$',
    )


    for index in range(
        start_index,
        min(
            start_index + 40,
            len(fragments)
        )
    ):

        fragment = fragments[index]


        if any(
            re.fullmatch(
                pattern,
                fragment,
                re.I
            )
            for pattern in section_end_patterns
        ):

            end_index = index
            break


    if end_index is None:

        end_index = min(
            start_index + 20,
            len(fragments)
        )


    stock_fragments = fragments[
        start_index:end_index
    ]


    # -----------------------------------------------------
    # Find warehouse rows
    # -----------------------------------------------------

    locations = []


    for fragment in stock_fragments:

        value = clean(
            fragment
        )


        # Ignore obvious interface text.

        if not value:
            continue


        if re.fullmatch(
            r'(в наличии|характеристики|'
            r'все характеристики|'
            r'подробнее|'
            r'сравнение|'
            r'избранное|'
            r'описание)',
            value,
            re.I
        ):

            continue


        # -------------------------------------------------
        # Expected warehouse format:
        #
        # Chinobod 60
        # Jagban 25
        # Корасув 150
        # Рахимова 16
        #
        # We allow punctuation and words in the name.
        # The quantity must be the FINAL number.
        # -------------------------------------------------

        match = re.match(
            r'^(.*?)'
            r'\s+'
            r'([0-9][0-9\s.,]*)'
            r'\s*$',
            value
        )


        if not match:
            continue


        warehouse_name = clean(
            match.group(1)
        )


        quantity_text = clean(
            match.group(2)
        )


        if not warehouse_name:
            continue


        quantity = to_number(
            quantity_text
        )


        # Quantity must actually be numeric.

        if quantity < 0:
            continue


        # Avoid treating unrelated long sentences
        # as warehouse names.

        if len(
            warehouse_name
        ) > 80:

            continue


        # Remove obvious non-warehouse fragments.

        if re.search(
            r'(so‘m|сум|сўм|'
            r'руб|dollar|usd|'
            r'отзыв|рейтинг|'
            r'характеристик|'
            r'описани)',
            warehouse_name,
            re.I
        ):

            continue


        locations.append(
            {
                'name':
                    warehouse_name,

                'quantity':
                    quantity
            }
        )


    # -----------------------------------------------------
    # Deduplicate identical warehouse names
    # -----------------------------------------------------

    deduped = {}


    for location in locations:

        key = clean(
            location['name']
        ).lower()


        if key in deduped:

            deduped[key][
                'quantity'
            ] += location['quantity']

        else:

            deduped[key] = {
                'name':
                    location['name'],

                'quantity':
                    location['quantity']
            }


    locations = list(
        deduped.values()
    )


    # -----------------------------------------------------
    # No warehouse rows found
    # -----------------------------------------------------

    if not locations:

        # Sometimes Eman only reports
        # availability without visible warehouse
        # numbers.

        for fragment in stock_fragments[:5]:

            if re.search(
                r'\bв\s+наличии\b',
                fragment,
                re.I
            ):

                return (
                    None,
                    '',
                    []
                )


        return (
            0,
            'шт.',
            []
        )


    # -----------------------------------------------------
    # Total
    # -----------------------------------------------------

    total_quantity = sum(
        location['quantity']
        for location in locations
    )


    return (
        total_quantity,
        'шт.',
        locations
    )


# =========================================================
# PRICE
# =========================================================

def extract_price(
    text: str,
    fallback_price=0
):

    prices = []


    for match in re.finditer(
        r'([0-9][0-9\s\u00a0.,]*)\s*'
        r'(?:so[‘’\'`]?m|сум|сўм|UZS)',
        text,
        re.I
    ):

        value = to_number(
            match.group(1)
        )


        if value > 0:

            prices.append(
                value
            )


    if prices:

        return max(
            prices
        )


    return fallback_price


# =========================================================
# MAIN PRODUCT IMAGE
# =========================================================

def extract_main_image(
    page: BeautifulSoup,
    product_url: str
) -> str:

    image_candidates = []


    html = html_module.unescape(
        str(page)
    )


    # -----------------------------------------------------
    # Absolute URLs
    # -----------------------------------------------------

    absolute_matches = re.findall(
        r'https://www\.eman\.uz/'
        r'media/product_images/'
        r'[^"\')\s<>]+',
        html,
        flags=re.I
    )


    # -----------------------------------------------------
    # Relative URLs
    # -----------------------------------------------------

    relative_matches = re.findall(
        r'/media/product_images/'
        r'[^"\')\s<>]+',
        html,
        flags=re.I
    )


    for match in (
        absolute_matches
        + relative_matches
    ):

        image_url = match


        if image_url.startswith('/'):

            image_url = absolute(
                image_url,
                product_url
            )


        image_url = (
            image_url
            .split('"')[0]
            .split("'")[0]
            .split(')')[0]
        )


        if image_url not in image_candidates:

            image_candidates.append(
                image_url
            )


    # -----------------------------------------------------
    # Filter non-product images
    # -----------------------------------------------------

    blocked = (
        'logo',
        'icon',
        'sprite',
        'placeholder',
        'flag',
        'language'
    )


    for image_url in image_candidates:

        if not image_url:
            continue


        low = image_url.lower()


        if any(
            item in low
            for item in blocked
        ):

            continue


        return image_url


    return ''
    # =========================================================
# PARSE PRODUCT DETAIL
# =========================================================

def parse_detail(
    url: str,
    fallback_name: str,
    fallback_image: str,
    fallback_price
):

    try:

        page = soup(
            url
        )

    except Exception as error:

        print(
            f'WARNING: failed to open '
            f'{url}: {error}'
        )

        return {
            'sku': '',
            'name': fallback_name,
            'image_url': fallback_image,
            'price': fallback_price,
            'stock_quantity': None,
            'stock_unit': '',
            'stock_locations': [],
            'extra': {}
        }


    # -----------------------------------------------------
    # FULL VISIBLE TEXT
    # -----------------------------------------------------

    text = clean(
        page.get_text(
            ' ',
            strip=True
        )
    )


    # -----------------------------------------------------
    # NAME
    # -----------------------------------------------------

    name = fallback_name

    h1 = page.find(
        'h1'
    )

    if h1:

        h1_text = clean(
            h1.get_text(
                ' ',
                strip=True
            )
        )

        if h1_text:

            name = h1_text


    # -----------------------------------------------------
    # ARTICLE / SKU
    # -----------------------------------------------------

    sku = extract_article(
        page
    )


    # -----------------------------------------------------
    # PRICE
    # -----------------------------------------------------

    price = extract_price(
        text,
        fallback_price
    )


    # -----------------------------------------------------
    # STOCK
    # -----------------------------------------------------

    (
        stock_quantity,
        stock_unit,
        stock_locations
    ) = extract_stock(
        page
    )


    # -----------------------------------------------------
    # MAIN IMAGE
    # -----------------------------------------------------

    main_image = extract_main_image(
        page,
        url
    )


    if not main_image:

        main_image = fallback_image


    # -----------------------------------------------------
    # EXTRA
    # -----------------------------------------------------

    extra = {}


    if stock_locations:

        extra['stock_locations'] = (
            stock_locations
        )


    return {

        'sku':
            sku,

        'name':
            name,

        'image_url':
            main_image,

        'price':
            price,

        'stock_quantity':
            stock_quantity,

        'stock_unit':
            stock_unit,

        'stock_locations':
            stock_locations,

        'extra':
            extra

    }


# =========================================================
# PARSE LIST PAGE
# =========================================================

def parse_list_page(
    url: str,
    brand: str,
    group: str
):

    page = soup(
        url
    )

    results = []


    for (
        name,
        href,
        block
    ) in find_product_cards(
        page
    ):

        # -------------------------------------------------
        # TEXT
        # -------------------------------------------------

        text = clean(
            block.get_text(
                ' ',
                strip=True
            )
        )


        # -------------------------------------------------
        # IMAGE
        # -------------------------------------------------

        image = ''


        if block:

            img = block.find(
                'img'
            )

            if img:

                image = absolute(
                    img.get('src')
                    or img.get('data-src')
                    or '',
                    url
                )


        # -------------------------------------------------
        # PRICE
        # -------------------------------------------------

        price_match = re.search(

            r'([0-9][0-9\s\u00a0.,]*)\s*'

            r'(?:so‘m|so\s*m|сум|сўм|UZS)',

            text,

            re.I

        )


        price = (

            to_number(
                price_match.group(1)
            )

            if price_match

            else 0

        )


        # -------------------------------------------------
        # DETAIL PAGE
        # -------------------------------------------------

        detail = parse_detail(

            href,

            name,

            image,

            price

        )


        # -------------------------------------------------
        # EMAN ID
        # -------------------------------------------------

        eman_id = urlparse(
            href
        ).path.rstrip('/')


        # -------------------------------------------------
        # PRODUCT
        # -------------------------------------------------

        results.append(

            Product(

                eman_id,

                href,

                detail['sku'],

                detail['name'],

                brand,

                group,

                group,

                detail['price'],

                'UZS',

                detail['image_url'],

                detail['stock_quantity'],

                detail['stock_unit'],

                detail['extra']

            )

        )


    return results


# =========================================================
# PAGINATION
# =========================================================

def next_page(
    page: BeautifulSoup,
    current_url: str
):

    for link in page.find_all(
        'a',
        href=True
    ):

        text = clean(
            link.get_text(
                ' ',
                strip=True
            )
        )


        if text in {

            '>',

            'Следующая',

            'Next'

        }:

            return absolute(

                link['href'],

                current_url

            )


    return None


# =========================================================
# FETCH GROUP
# =========================================================

def fetch_group(
    cfg
):

    items = []

    url = cfg[
        'url'
    ]

    visited = set()


    while (
        url
        and url not in visited
    ):

        visited.add(
            url
        )


        print(
            f'Fetching page: {url}'
        )


        try:

            page = soup(
                url
            )

        except Exception as error:

            print(
                f'WARNING: failed to fetch '
                f'group page {url}: {error}'
            )

            break


        cards = find_product_cards(
            page
        )


        print(
            f'Found {len(cards)} '
            f'product cards'
        )


        for (
            index,
            (
                name,
                href,
                block
            )
        ) in enumerate(
            cards,
            start=1
        ):

            try:

                # -----------------------------------------
                # LISTING TEXT
                # -----------------------------------------

                text = clean(
                    block.get_text(
                        ' ',
                        strip=True
                    )
                )


                # -----------------------------------------
                # LISTING IMAGE
                # -----------------------------------------

                image = ''


                img = (

                    block.find(
                        'img'
                    )

                    if block

                    else None

                )


                if img:

                    image = absolute(

                        img.get('src')

                        or img.get(
                            'data-src'
                        )

                        or '',

                        url

                    )


                # -----------------------------------------
                # LISTING PRICE
                # -----------------------------------------

                price_match = re.search(

                    r'([0-9][0-9\s\u00a0.,]*)\s*'

                    r'(?:so‘m|so\s*m|сум|сўм|UZS)',

                    text,

                    re.I

                )


                price = (

                    to_number(
                        price_match.group(
                            1
                        )
                    )

                    if price_match

                    else 0

                )


                # -----------------------------------------
                # DETAIL PAGE
                # -----------------------------------------

                detail = parse_detail(

                    href,

                    name,

                    image,

                    price

                )


                eman_id = urlparse(
                    href
                ).path.rstrip('/')


                product = Product(

                    eman_id,

                    href,

                    detail[
                        'sku'
                    ],

                    detail[
                        'name'
                    ],

                    cfg[
                        'brand'
                    ],

                    cfg[
                        'eman_group'
                    ],

                    cfg[
                        'eman_group'
                    ],

                    detail[
                        'price'
                    ],

                    'UZS',

                    detail[
                        'image_url'
                    ],

                    detail[
                        'stock_quantity'
                    ],

                    detail[
                        'stock_unit'
                    ],

                    detail[
                        'extra'
                    ]

                )


                items.append(
                    product
                )


                # -----------------------------------------
                # DEBUG OUTPUT
                # -----------------------------------------

                locations_count = len(
                    detail[
                        'stock_locations'
                    ]
                )


                print(

                    f'[{index}/{len(cards)}] '

                    f'{detail["name"]} '

                    f'| SKU: '
                    f'{detail["sku"] or "-"} '

                    f'| Stock: '
                    f'{detail["stock_quantity"]} '

                    f'| Locations: '
                    f'{locations_count}'

                )


            except Exception as error:

                print(

                    f'WARNING: failed to parse '
                    f'product {href}: {error}'

                )


        # -------------------------------------------------
        # NEXT PAGE
        # -------------------------------------------------

        url = next_page(
            page,
            url
        )


        time.sleep(
            0.5
        )


    return items


# =========================================================
# SUPABASE
# =========================================================

def supabase_upsert(
    products
):

    sb_url = os.environ[
        'SUPABASE_URL'
    ].rstrip('/')


    key = os.environ[
        'SUPABASE_SERVICE_ROLE_KEY'
    ]


    endpoint = (

        f'{sb_url}'

        '/rest/v1/eman_products'

        '?on_conflict=eman_id'

    )


    headers = {

        'apikey':
            key,

        'Content-Type':
            'application/json',

        'Prefer':
            'resolution=merge-duplicates,'
            'return=minimal'

    }


    rows = [

        {

            'eman_id':
                product.eman_id,

            'source_url':
                product.source_url,

            'sku':
                product.sku,

            'name':
                product.name,

            'brand':
                product.brand,

            'eman_group':
                product.eman_group,

            'category':
                product.category,

            'price':
                product.price,

            'currency':
                product.currency,

            'image_url':
                product.image_url,

            'stock_quantity':
                product.stock_quantity,

            'stock_unit':
                product.stock_unit,

            'extra':
                product.extra,

            'synced_at':
                datetime.now(
                    timezone.utc
                ).isoformat()

        }

        for product in products

    ]


    print(
        f'Uploading '
        f'{len(rows)} products '
        f'to Supabase...'
    )


    for i in range(
        0,
        len(rows),
        500
    ):

        batch = rows[
            i:i + 500
        ]


        response = requests.post(

            endpoint,

            headers=headers,

            json=batch,

            timeout=60

        )


        if not response.ok:

            print(
                'Supabase error:',
                response.status_code,
                response.text[:1000]
            )


        response.raise_for_status()


        print(

            f'Uploaded '
            f'{i + len(batch)} / '
            f'{len(rows)}'

        )

# =========================================================
# MAIN
# =========================================================

def main():

    # -----------------------------------------------------
    # Environment
    # -----------------------------------------------------

    for env in (
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
    ):

        if not os.getenv(env):

            raise RuntimeError(
                f'Missing required environment variable: {env}'
            )


    # -----------------------------------------------------
    # Discover Eman catalogs
    # -----------------------------------------------------

    groups = discover_group_links()


    print(
        f'Discovered {len(groups)} Eman catalogs.'
    )


    # -----------------------------------------------------
    # Fetch all products
    # -----------------------------------------------------

    all_products = []


    for cfg in groups:

        print(
            ''
        )

        print(
            '=' * 60
        )

        print(
            f"SYNCING: {cfg['brand']}"
        )

        print(
            f"URL: {cfg['url']}"
        )

        print(
            '=' * 60
        )


        try:

            group_products = fetch_group(
                cfg
            )


            print(
                f"Completed {cfg['brand']}: "
                f'{len(group_products)} products'
            )


            all_products.extend(
                group_products
            )


        except Exception as error:

            print(
                f"ERROR while syncing "
                f"{cfg['brand']}: {error}"
            )


    # -----------------------------------------------------
    # Safety check
    # -----------------------------------------------------

    if not all_products:

        raise RuntimeError(
            'No products were collected from Eman. '
            'Aborting to protect existing Supabase data.'
        )


    # -----------------------------------------------------
    # DEDUPE BY EMAN ID
    # -----------------------------------------------------

    unique = {}


    for product in all_products:

        unique[
            product.eman_id
        ] = product


    products = list(
        unique.values()
    )


    print(
        ''
    )


    print(
        f'Total unique products: '
        f'{len(products)}'
    )


    # -----------------------------------------------------
    # STOCK SUMMARY
    # -----------------------------------------------------

    products_with_stock = [

        product

        for product in products

        if (
            product.stock_quantity is not None
            and product.stock_quantity > 0
        )

    ]


    products_without_stock = [

        product

        for product in products

        if (
            product.stock_quantity is None
            or product.stock_quantity <= 0
        )

    ]


    total_stock = sum(

        product.stock_quantity or 0

        for product in products

    )


    print(
        f'Products with positive stock: '
        f'{len(products_with_stock)}'
    )


    print(
        f'Products without positive stock: '
        f'{len(products_without_stock)}'
    )


    print(
        f'Total parsed stock quantity: '
        f'{total_stock}'
    )


    # -----------------------------------------------------
    # SKU SUMMARY
    # -----------------------------------------------------

    products_with_sku = [

        product

        for product in products

        if product.sku

    ]


    print(
        f'Products with Eman article: '
        f'{len(products_with_sku)}'
    )


    # -----------------------------------------------------
    # SUPABASE
    # -----------------------------------------------------

    print(
        ''
    )

    print(
        'Uploading products to Supabase...'
    )


    supabase_upsert(
        products
    )


    print(
        'Supabase upload completed.'
    )


    # -----------------------------------------------------
    # FALLBACK SNAPSHOT
    # -----------------------------------------------------

    print(
        'Writing fallback snapshot...'
    )


    snapshot = {

        'generated_at':
            datetime.now()
            .astimezone()
            .isoformat(),

        'source':
            BASE,

        'products':
            [

                asdict(
                    product
                )

                | {

                    'id':
                        product.eman_id,

                    'published':
                        False

                }

                for product in products

            ]

    }


    OUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    OUT.write_text(

        json.dumps(
            snapshot,
            ensure_ascii=False,
            indent=2
        ),

        encoding='utf-8'

    )


    # -----------------------------------------------------
    # FINAL REPORT
    # -----------------------------------------------------

    print(
        ''
    )

    print(
        '=' * 60
    )

    print(
        'SYNC COMPLETED SUCCESSFULLY'
    )

    print(
        '=' * 60
    )

    print(
        f'Products: '
        f'{len(products)}'
    )

    print(
        f'Articles: '
        f'{len(products_with_sku)}'
    )

    print(
        f'Positive stock products: '
        f'{len(products_with_stock)}'
    )

    print(
        f'Total stock quantity: '
        f'{total_stock}'
    )

    print(
        f'Fallback snapshot: '
        f'{OUT}'
    )

    print(
        '=' * 60
    )


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == '__main__':

    main()
