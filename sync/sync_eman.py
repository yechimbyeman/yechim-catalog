"""YECHIM Catalog — Eman → Supabase synchronizer.

Eman is the source of truth for:
- article / SKU
- product name
- price
- source brand
- source category/group
- main image
- stock quantity
- stock by warehouse

YECHIM-specific enrichment is stored separately in Supabase
and is not overwritten by this synchronizer.

GitHub Actions schedule:
00:00 UTC = 05:00 Asia/Tashkent.
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
        '(+https://github.com/yechimbyman/yechim-catalog)'
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

    sku: str
    name: str
    brand: str

    eman_group: str
    category: str

    price: float | int
    currency: str

    image_url: str

    # Additional product gallery images from Eman.
    additional_images: list[str]

    # Total stock across all warehouses
    stock_quantity: float | int | None

    # Usually "шт."
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
# TEXT HELPERS
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


    text = str(value)

    text = text.replace(
        '\xa0',
        ' '
    )

    text = text.strip()


    digits = re.sub(
        r'[^0-9.]',
        '',
        text
    )


    if not digits:
        return 0


    try:

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

def extract_article_from_text(value: str) -> str:
    """Extract the article label/value from a product page or listing card."""
    pattern = re.compile(
        r'\bартикул\b\s*[:№#-]?\s*'
        r'([A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9._/-]*)',
        re.I
    )
    match = pattern.search(clean(value or ''))
    return clean(match.group(1)) if match else ''


def extract_article(page: BeautifulSoup) -> str:
    """Extract Eman's article from visible text or structured product markup."""
    for node in page.find_all(string=re.compile(r'\bартикул\b', re.I)):
        parent = node.parent
        if not parent:
            continue
        candidates = [parent.get_text(' ', strip=True)]
        if parent.parent:
            candidates.append(parent.parent.get_text(' ', strip=True))
        for candidate in candidates:
            article = extract_article_from_text(candidate)
            if article:
                return article

    for selector in ('[itemprop="sku"]', '[data-article]', '[data-sku]'):
        node = page.select_one(selector)
        if not node:
            continue
        value = clean(
            node.get('content')
            or node.get('data-article')
            or node.get('data-sku')
            or node.get_text(' ', strip=True)
        )
        if value:
            return value

    # Last resort: the whole visible page text, useful when the label and
    # value are split across adjacent elements in Eman's product template.
    return extract_article_from_text(page.get_text(' ', strip=True))



# =========================================================
# DESCRIPTION / CHARACTERISTICS
# =========================================================

def _node_marker(node) -> str:
    """Return normalized id/class marker for a BeautifulSoup node."""
    if not getattr(node, 'attrs', None):
        return ''
    classes = node.get('class') or []
    if isinstance(classes, str):
        classes = [classes]
    return ' '.join([str(node.get('id') or ''), *map(str, classes)]).lower()


def _find_content_section(page: BeautifulSoup, labels, marker_words):
    """Find the smallest useful section around a matching product heading."""
    wanted = {clean(label).casefold() for label in labels}
    for heading in page.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'button', 'a', 'div', 'span']):
        heading_text = clean(heading.get_text(' ', strip=True)).casefold()
        if heading_text not in wanted:
            continue
        current = heading
        fallback = None
        for depth in range(5):
            current = current.parent
            if not current or not getattr(current, 'name', None):
                break
            if fallback is None and clean(current.get_text(' ', strip=True)).casefold() != heading_text:
                fallback = current
            marker = _node_marker(current)
            if any(word in marker for word in marker_words):
                return current
        if fallback is not None:
            return fallback
    return None


def _extract_spec_rows(root) -> list[dict]:
    """Extract label/value pairs from common table, definition-list and div layouts."""
    if root is None:
        return []

    rows = []
    seen = set()

    def add(name, value):
        name = clean(name)
        value = clean(value)
        if not name or not value or name.casefold() == value.casefold():
            return
        if len(name) > 120 or len(value) > 500:
            return
        key = (name.casefold(), value.casefold())
        if key not in seen:
            seen.add(key)
            rows.append({'name': name.rstrip(':：'), 'value': value})

    for table_row in root.select('tr'):
        cells = table_row.find_all(['th', 'td'], recursive=False)
        if len(cells) >= 2:
            add(cells[0].get_text(' ', strip=True), cells[1].get_text(' ', strip=True))
        elif len(cells) == 1:
            text = clean(cells[0].get_text(' ', strip=True))
            match = re.match(r'^(.{1,120}?)[：:]\s*(.{1,500})$', text)
            if match:
                add(match.group(1), match.group(2))

    for term, definition in zip(root.select('dt'), root.select('dd')):
        add(term.get_text(' ', strip=True), definition.get_text(' ', strip=True))

    # Common product-property markup used by ecommerce templates.
    for row in root.select('[class*="characteristic"], [class*="property"], [class*="specification"], [class*="attribute"]'):
        name_node = row.select_one('[class*="name"], [class*="title"], [class*="label"], th')
        value_node = row.select_one('[class*="value"], [class*="content"], td')
        if name_node and value_node and name_node is not value_node:
            add(name_node.get_text(' ', strip=True), value_node.get_text(' ', strip=True))

    # A final fallback for compact rows where each child contains name and value.
    if not rows:
        for row in root.find_all(['li', 'div'], recursive=True):
            children = row.find_all(['span', 'div', 'p', 'b', 'strong'], recursive=False)
            if len(children) == 2:
                add(children[0].get_text(' ', strip=True), children[1].get_text(' ', strip=True))

    return rows


def extract_product_content(page: BeautifulSoup) -> tuple[str, list[dict]]:
    """Extract the fullest available Eman product description and characteristics."""
    description_candidates = []
    description_root = _find_content_section(
        page,
        ('Описание', 'Description', 'Tavsif'),
        ('description', 'product-about', 'about-product')
    )

    selectors = (
        '[itemprop="description"]',
        '[class*="description-text"]',
        '[class*="description-content"]',
        '[class*="product-description"]',
        '[class*="description"]',
        '#description'
    )
    roots = [description_root] if description_root is not None else []
    roots.extend(page.select(', '.join(selectors)))

    for root in roots:
        if root is None:
            continue
        # Prefer a nested full-text container over the surrounding tab or preview.
        nested = root.select_one('[itemprop="description"], [class*="description-text"], [class*="description-content"], [class*="product-description"]')
        target = nested or root
        parts = [clean(x) for x in target.stripped_strings]
        parts = [
            value for value in parts
            if value and value.casefold() not in {
                'описание', 'description', 'подробнее', 'читать далее',
                'показать полностью', 'свернуть'
            }
        ]
        candidate = clean(' '.join(parts))
        if len(candidate) >= 40:
            description_candidates.append(candidate)

    # Some product pages expose the complete description in Product JSON-LD
    # even when the visible tab contains only a shortened preview.
    def collect_product_descriptions(value):
        if isinstance(value, dict):
            kind = value.get('@type')
            if kind == 'Product' or (isinstance(kind, list) and 'Product' in kind):
                text = value.get('description')
                if isinstance(text, str) and len(clean(text)) >= 40:
                    description_candidates.append(clean(text))
            for child in value.values():
                collect_product_descriptions(child)
        elif isinstance(value, list):
            for child in value:
                collect_product_descriptions(child)

    for script in page.select('script[type="application/ld+json"]'):
        raw_json = script.string or script.get_text()
        if not raw_json:
            continue
        try:
            collect_product_descriptions(json.loads(raw_json))
        except (json.JSONDecodeError, TypeError):
            continue

    description = max(description_candidates, key=len, default='')

    specs_root = _find_content_section(
        page,
        ('Характеристики', 'Все характеристики', 'Specifications', 'Characteristics'),
        ('characteristic', 'specification', 'product-properties', 'product-attributes')
    )
    specs = _extract_spec_rows(specs_root)

    if not specs:
        specs_root = _find_content_section(
            page,
            ('Все характеристики', 'Specifications', 'Characteristics'),
            ('tab', 'product', 'detail')
        )
        specs = _extract_spec_rows(specs_root)

    return description, specs

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
    Extract all warehouse stock values from an Eman
    product page.

    Eman can display:

        В наличии

        Jagban-2 (Yechim Магазин) 25
        Chilanzar - розничная точка 10
        Yechim Rakhimova 12
        Qorasuv - 5 (Розничная точка) 7
        Chinobod-7 (Розничная точка) 60
        Chinobod-6 (Yechim) 20

    The code does NOT hard-code warehouse names.

    It identifies the "В наличии" section and then
    searches the following page fragments for rows
    ending with a numeric quantity.

    Returns:

        total_quantity,
        stock_unit,
        stock_locations
    """


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
    # Find "В наличии"
    # -----------------------------------------------------

    start_index = None


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


    # If the exact standalone heading was not found,
    # try a less strict match.

    if start_index is None:

        for index, fragment in enumerate(
            fragments
        ):

            if re.search(
                r'\bв\s+наличии\b',
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
    # Find the end of the availability block
    # -----------------------------------------------------

    end_index = len(
        fragments
    )


    end_patterns = (
        r'^характеристики$',
        r'^все характеристики$',
        r'^описание$',
        r'^подробнее$',
        r'^комментарии$',
        r'^оставить отзыв$',
        r'^сравнение$',
        r'^избранное$'
    )


    for index in range(
        start_index,
        min(
            start_index + 50,
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
            for pattern in end_patterns
        ):

            end_index = index

            break


    stock_fragments = fragments[
        start_index:end_index
    ]


    # -----------------------------------------------------
    # Find rows:
    #
    # Warehouse name + final number
    #
    # Examples:
    #
    # Chinobod-6 (Yechim) 20
    # Jagban-2 (Yechim Магазин) 25
    # -----------------------------------------------------

    locations = []


    for fragment in stock_fragments:

        value = clean(
            fragment
        )


        if not value:
            continue


        # Skip UI text.

        if re.fullmatch(
            r'(в наличии|'
            r'характеристики|'
            r'все характеристики|'
            r'подробнее|'
            r'описание|'
            r'сравнение|'
            r'избранное|'
            r'комментарии|'
            r'оставить отзыв)',
            value,
            re.I
        ):

            continue


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


        if quantity < 0:

            continue


        # Avoid treating prices, ratings or
        # other long blocks as warehouses.

        if len(
            warehouse_name
        ) > 100:

            continue


        if re.search(
            r'(so‘m|so.?m|сум|сўм|'
            r'uzs|руб|usd|'
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
    # Deduplicate warehouse names
    # -----------------------------------------------------

    deduped = {}


    for location in locations:

        key = clean(
            location['name']
        ).lower()


        if key in deduped:

            deduped[key][
                'quantity'
            ] += location[
                'quantity'
            ]

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
    # No warehouse rows
    # -----------------------------------------------------

    if not locations:

        return (
            None,
            '',
            []
        )


    # -----------------------------------------------------
    # Total stock
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

def extract_product_images(
    page: BeautifulSoup,
    product_url: str
) -> list[str]:
    """Extract all unique product gallery images in display order."""

    candidates = []
    gallery = page.select_one('.products-gallery-list')

    # Preferred method: images inside the product gallery only.
    if gallery:
        for img in gallery.find_all('img'):
            for attr in ('src', 'data-src', 'data-original', 'data-lazy-src'):
                value = img.get(attr)
                if value and 'product_images' in value.lower():
                    candidates.append(absolute(value, product_url))
                    break

    # Fallback: parse image URLs from the page HTML if the gallery selector
    # is unavailable or produced no images.
    if not candidates:
        html = html_module.unescape(str(page))
        candidates.extend(re.findall(
            r"/media/product_images/[^\"'\)\s<>]+",
            html,
            flags=re.I
        ))

    unique = []
    blocked = ('logo', 'icon', 'sprite', 'placeholder', 'flag', 'language')

    for value in candidates:
        value = html_module.unescape(str(value)).strip()
        value = value.split('"')[0].split("'")[0].split(')')[0]
        if not value:
            continue
        value = absolute(value, product_url)
        if any(word in value.lower() for word in blocked):
            continue
        if value not in unique:
            unique.append(value)

    return unique


def extract_main_image(
    page: BeautifulSoup,
    product_url: str
) -> str:
    """Return the first product gallery image, for compatibility."""
    images = extract_product_images(page, product_url)
    return images[0] if images else ''

# =========================================================
# DISCOVER EMAN GROUP LINKS
# =========================================================

def discover_group_links() -> list[dict]:

    page = soup(
        HOME
    )


    wanted = {

        'Cebi':
            'CEBI',

        'Starax':
            'STARAX',

        'Mesan':
            'MESAN',

        'Samet':
            'SAMET',

        'Мебельная подсветка':
            'YECHIM LIGHTING'

    }


    found = {}


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


        if (
            text in wanted
            and text not in found
        ):

            found[text] = {

                'brand':
                    wanted[text],

                'eman_group':
                    text,

                'url':
                    absolute(
                        link['href'],
                        HOME
                    )

            }


    missing = (
        set(wanted)
        - set(found)
    )


    if missing:

        raise RuntimeError(
            'Не удалось найти каталоги Eman: '
            f'{sorted(missing)}'
        )


    return list(
        found.values()
    )


# =========================================================
# FIND PRODUCT CARDS
# =========================================================

def find_product_cards(
    page: BeautifulSoup
):

    cards = []


    for heading in page.find_all(
        ['h2', 'h3', 'h4']
    ):

        link = heading.find(
            'a',
            href=True
        )


        if not link:

            continue


        name = clean(
            link.get_text(
                ' ',
                strip=True
            )
        )


        href = absolute(
            link['href'],
            BASE
        )


        # We need only product pages.

        if (
            not name
            or '/product/' not in href
            or '/list/' in href
        ):

            continue


        # -------------------------------------------------
        # Find a parent block containing the card.
        # -------------------------------------------------

        block = heading


        for _ in range(8):

            if not block:

                break


            has_image = bool(
                block.find(
                    'img'
                )
            )


            has_price = bool(
                block.find(
                    string=re.compile(
                        r'(so‘m|so.?m|сум|сўм|UZS)',
                        re.I
                    )
                )
            )


            if (
                has_image
                and has_price
            ):

                break


            block = block.parent


        cards.append(
            (
                name,
                href,
                block or heading
            )
        )


    # -----------------------------------------------------
    # Remove duplicates.
    # -----------------------------------------------------

    result = []

    seen = set()


    for item in cards:

        url = item[1]


        if url in seen:

            continue


        seen.add(
            url
        )


        result.append(
            item
        )


    return result


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

            'sku':
                '',

            'name':
                fallback_name,

            'image_url':
                fallback_image,

            'additional_images':
                [],

            'price':
                fallback_price,

            'stock_quantity':
                None,

            'stock_unit':
                '',

            'stock_locations':
                [],

            'description':
                '',

            'specs':
                [],

            'extra':
                {}

        }


    # -----------------------------------------------------
    # Full visible text
    # -----------------------------------------------------

    text = clean(
        page.get_text(
            ' ',
            strip=True
        )
    )


    # -----------------------------------------------------
    # Product name
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
    # Article
    # -----------------------------------------------------

    sku = extract_article(page)


    # -----------------------------------------------------
    # Price
    # -----------------------------------------------------

    price = extract_price(
        text,
        fallback_price
    )


    # -----------------------------------------------------
    # Description and characteristics from Eman
    # -----------------------------------------------------

    description, specs = extract_product_content(page)


    # -----------------------------------------------------
    # Stock
    # -----------------------------------------------------

    (
        stock_quantity,
        stock_unit,
        stock_locations
    ) = extract_stock(
        page
    )


    # -----------------------------------------------------
    # Main image
    # -----------------------------------------------------

    product_images = extract_product_images(
        page,
        url
    )

    main_image = product_images[0] if product_images else fallback_image
    additional_images = product_images[1:] if len(product_images) > 1 else []


    # -----------------------------------------------------
    # Extra
    # -----------------------------------------------------

    extra = {}


    if description:
        extra['eman_description'] = description

    if specs:
        extra['eman_specs'] = specs


    if stock_locations:

        extra[
            'stock_locations'
        ] = stock_locations


    return {

        'sku':
            sku,

        'name':
            name,

        'image_url':
            main_image,

        'additional_images':
            additional_images,

        'price':
            price,

        'stock_quantity':
            stock_quantity,

        'stock_unit':
            stock_unit,

        'stock_locations':
            stock_locations,

        'description':
            description,

        'specs':
            specs,

        'extra':
            extra

    }


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
                f'{url}: {error}'
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
                # Listing text
                # -----------------------------------------

                text = clean(
                    block.get_text(
                        ' ',
                        strip=True
                    )
                )


                # -----------------------------------------
                # Listing image
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
                # Listing price
                # -----------------------------------------

                price_match = re.search(

                    r'([0-9][0-9\s\u00a0.,]*)\s*'

                    r'(?:so‘m|so.?m|сум|сўм|UZS)',

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
                # Product detail
                # -----------------------------------------

                detail = parse_detail(
                    href,
                    name,
                    image,
                    price
                )


                # -----------------------------------------
                # Stable Eman ID
                # -----------------------------------------

                eman_id = urlparse(
                    href
                ).path.rstrip('/')


                # -----------------------------------------
                # Build Product object
                # -----------------------------------------

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
                        'additional_images'
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
                # Debug information
                # -----------------------------------------

                print(

                    f'[{index}/{len(cards)}] '

                    f'{detail["name"]} '

                    f'| SKU: '
                    f'{detail["sku"] or "-"} '

                    f'| Stock: '
                    f'{detail["stock_quantity"]} '

                    f'| Locations: '
                    f'{len(detail["stock_locations"])}'

                )


            except Exception as error:

                print(

                    f'WARNING: failed to parse '
                    f'product {href}: {error}'

                )


        # -------------------------------------------------
        # Next page
        # -------------------------------------------------

        next_url = next_page(
            page,
            url
        )


        url = next_url


        time.sleep(
            0.5
        )


    return items
    # =========================================================
# PAGINATION
# =========================================================

def next_page(
    page: BeautifulSoup,
    current_url: str
):

    # -----------------------------------------------------
    # Try to find a standard "next" link.
    # -----------------------------------------------------

    next_words = {
        '>',
        '>>',
        'следующая',
        'следующая страница',
        'next',
        'next page',
        '›',
        '»'
    }


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


        if (
            text.lower()
            in next_words
        ):

            href = link.get(
                'href'
            )


            if href:

                return absolute(
                    href,
                    current_url
                )


    # -----------------------------------------------------
    # Try rel="next".
    # -----------------------------------------------------

    link = page.find(
        'a',
        attrs={
            'rel': 'next'
        },
        href=True
    )


    if link:

        return absolute(
            link['href'],
            current_url
        )


    return None


# =========================================================
# SUPABASE UPSERT
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

        'Authorization':
            f'Bearer {key}',

        'Content-Type':
            'application/json',

        'Prefer':
            'resolution=merge-duplicates,'
            'return=minimal'

    }


    rows_with_sku = []
    rows_without_sku = []

    for product in products:
        row = {
            'eman_id': product.eman_id,
            'source_url': product.source_url,
            'name': product.name,
            'brand': product.brand,
            'eman_group': product.eman_group,
            'category': product.category,
            'price': product.price,
            'currency': product.currency,
            'image_url': product.image_url,
            'stock_quantity': product.stock_quantity,
            'stock_unit': product.stock_unit,
            'extra': product.extra,
            'synced_at': datetime.now(timezone.utc).isoformat()
        }

        # Keep rows with and without SKU in separate batches.
        # Omitting SKU preserves the previously saved value in Supabase.
        if product.sku:
            row['sku'] = product.sku
            rows_with_sku.append(row)
        else:
            rows_without_sku.append(row)

    print(
        f'Uploading {len(products)} products to Supabase '
        f'({len(rows_with_sku)} with SKU, {len(rows_without_sku)} without SKU)...'
    )

    batch_size = 500
    uploaded = 0

    # Each request contains objects with an identical set of keys.
    for group_name, rows in (
        ('with SKU', rows_with_sku),
        ('without SKU', rows_without_sku)
    ):
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]
            response = requests.post(
                endpoint,
                headers=headers,
                json=batch,
                timeout=60
            )

            if not response.ok:
                print(
                    f'Supabase error ({group_name}):',
                    response.status_code,
                    response.text[:2000]
                )

            response.raise_for_status()
            uploaded += len(batch)
            print(f'Uploaded {uploaded} / {len(products)} products')


# =========================================================
# SUPABASE GALLERY IMAGES
# =========================================================

def supabase_upsert_additional_images(products):
    """Update only gallery images, preserving other YECHIM enrichment fields."""

    sb_url = os.environ['SUPABASE_URL'].rstrip('/')
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    endpoint = f'{sb_url}/rest/v1/yechim_enrichment?on_conflict=eman_id'

    headers = {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    }

    rows = [
        {
            'eman_id': product.eman_id,
            'additional_images': product.additional_images
        }
        for product in products
    ]

    print(f'Uploading gallery images for {len(rows)} products to Supabase...')
    batch_size = 500

    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        response = requests.post(
            endpoint,
            headers=headers,
            json=batch,
            timeout=60
        )

        if not response.ok:
            print(
                'Supabase gallery-images error:',
                response.status_code,
                response.text[:2000]
            )
        response.raise_for_status()
        uploaded = min(start + batch_size, len(rows))
        print(f'Gallery images uploaded: {uploaded} / {len(rows)}')


# =========================================================
# FALLBACK SNAPSHOT
# =========================================================

def write_snapshot(
    products
):

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


    print(
        f'Fallback snapshot written: {OUT}'
    )


# =========================================================
# STOCK REPORT
# =========================================================

def print_stock_report(
    products
):

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


    products_with_sku = [

        product

        for product in products

        if product.sku

    ]


    total_stock = sum(

        product.stock_quantity or 0

        for product in products

    )


    print(
        ''
    )


    print(
        'STOCK REPORT'
    )


    print(
        '-' * 50
    )


    print(
        'Products:',
        len(products)
    )


    print(
        'Products with article:',
        len(products_with_sku)
    )


    print(
        'Products with positive stock:',
        len(products_with_stock)
    )


    print(
        'Products without positive stock:',
        len(products_without_stock)
    )


    print(
        'Total parsed stock:',
        total_stock
    )


    print(
        '-' * 50
    )


    # -----------------------------------------------------
    # Print a few real examples.
    # This makes GitHub Actions easy to inspect.
    # -----------------------------------------------------

    examples = [

        product

        for product in products

        if (
            product.stock_quantity is not None
            and product.stock_quantity > 0
        )

    ][:10]


    if examples:

        print(
            'STOCK EXAMPLES:'
        )


        for product in examples:

            locations = product.extra.get(
                'stock_locations',
                []
            )


            print(

                f'- {product.name} '
                f'| SKU: {product.sku or "-"} '
                f'| Total: '
                f'{product.stock_quantity} '
                f'{product.stock_unit or ""} '
                f'| Warehouses: '
                f'{len(locations)}'

            )


# =========================================================
# SAFETY CHECK
# =========================================================

def validate_products(
    products
):

    if not products:

        raise RuntimeError(
            'No products were collected from Eman. '
            'Sync aborted to protect existing data.'
        )


    # -----------------------------------------------------
    # Prevent an accidentally broken parser from
    # replacing the whole catalog with a tiny dataset.
    # -----------------------------------------------------

    if len(products) < 100:

        print(

            'WARNING: only '
            f'{len(products)} products were collected. '

            'This is unusually low for the Eman catalog.'

        )


    # -----------------------------------------------------
    # Check for invalid records.
    # -----------------------------------------------------

    invalid = [

        product

        for product in products

        if (
            not product.eman_id
            or not product.source_url
            or not product.name
        )

    ]


    if invalid:

        raise RuntimeError(

            'Invalid product records found: '
            f'{len(invalid)}'

        )
# =========================================================
# MAIN
# =========================================================

def main():

    # -----------------------------------------------------
    # Check environment variables
    # -----------------------------------------------------

    required_env = (
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
    )


    for env_name in required_env:

        if not os.getenv(
            env_name
        ):

            raise RuntimeError(
                f'Missing required environment variable: '
                f'{env_name}'
            )


    # -----------------------------------------------------
    # Discover Eman catalogs
    # -----------------------------------------------------

    print(
        'Discovering Eman catalogs...'
    )


    groups = discover_group_links()


    print(
        f'Discovered '
        f'{len(groups)} '
        f'Eman catalogs.'
    )


    # -----------------------------------------------------
    # Fetch all products
    # -----------------------------------------------------

    all_products = []


    for cfg in groups:

        print('')

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

                f"Completed "
                f"{cfg['brand']}: "
                f"{len(group_products)} "
                f"products"

            )


            all_products.extend(
                group_products
            )


        except Exception as error:

            print(

                f"ERROR while syncing "
                f"{cfg['brand']}: "
                f"{error}"

            )


    # -----------------------------------------------------
    # Safety check
    # -----------------------------------------------------

    if not all_products:

        raise RuntimeError(

            'No products were collected from Eman. '
            'Sync aborted to protect existing Supabase data.'

        )


    # -----------------------------------------------------
    # DEDUPLICATION
    # -----------------------------------------------------

    unique = {}


    for product in all_products:

        unique[
            product.eman_id
        ] = product


    products = list(
        unique.values()
    )


    print('')

    print(
        f'Total unique products: '
        f'{len(products)}'
    )


    # -----------------------------------------------------
    # Validate
    # -----------------------------------------------------

    validate_products(
        products
    )


    # -----------------------------------------------------
    # Stock report BEFORE upload
    # -----------------------------------------------------

    print_stock_report(
        products
    )


    # -----------------------------------------------------
    # Supabase upload
    # -----------------------------------------------------

    print('')

    print(
        '=' * 60
    )

    print(
        'Uploading catalog to Supabase...'
    )

    print(
        '=' * 60
    )


    supabase_upsert(
        products
    )

    supabase_upsert_additional_images(
        products
    )


    print(
        'Supabase upload completed.'
    )


    # -----------------------------------------------------
    # Fallback snapshot
    # -----------------------------------------------------

    write_snapshot(
        products
    )


    # -----------------------------------------------------
    # Final report
    # -----------------------------------------------------

    products_with_sku = [

        product

        for product in products

        if product.sku

    ]


    products_with_stock = [

        product

        for product in products

        if (
            product.stock_quantity
            is not None
            and
            product.stock_quantity > 0
        )

    ]


    total_stock = sum(

        product.stock_quantity or 0

        for product in products

    )


    print('')

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
        f'Products with positive stock: '
        f'{len(products_with_stock)}'
    )

    print(
        f'Total stock quantity: '
        f'{total_stock}'
    )

    print(
        '=' * 60
    )


# =========================================================
# ENTRY POINT
# =========================================================

if __name__ == '__main__':

    main()
