"""Sync the selected Eman catalog into Supabase.

Eman is the source of truth for SKU/name/price/base brand/category/images.
YECHIM-only fields stay in Supabase table yechim_enrichment and are never overwritten here.
The job is designed for GitHub Actions at 06:00 Asia/Tashkent (01:00 UTC).
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


BASE = 'https://www.eman.uz'
HOME = f'{BASE}/ru/'

HEADERS = {
    'User-Agent':
        'YECHIM-Catalog-Sync/1.0 (+https://github.com/yechimmaterials/yechim-catalog)'
}

OUT = (
    Path(__file__).resolve().parents[1]
    / 'data'
    / 'products.json'
)


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
    extra: dict


session = requests.Session()
session.headers.update(HEADERS)


# =========================================================
# HELPERS
# =========================================================

def clean(value: str) -> str:
    return re.sub(
        r'\s+',
        ' ',
        (value or '').replace('\xa0', ' ')
    ).strip()


def to_number(value: str):
    digits = re.sub(
        r'[^0-9.]',
        '',
        value or ''
    )

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

    r = session.get(
        url,
        timeout=40
    )

    r.raise_for_status()

    return BeautifulSoup(
        r.text,
        'html.parser'
    )


# =========================================================
# DISCOVER EMAN GROUPS
# =========================================================

def discover_group_links() -> list[dict]:

    s = soup(HOME)

    wanted = {
        'Cebi': 'CEBI',
        'Starax': 'STARAX',
        'Mesan': 'MESAN',
        'Samet': 'SAMET',
        'Мебельная подсветка': 'YECHIM LIGHTING'
    }

    found = {}

    for a in s.find_all(
        'a',
        href=True
    ):

        txt = clean(
            a.get_text(
                ' ',
                strip=True
            )
        )

        if (
            txt in wanted
            and txt not in found
        ):

            found[txt] = {
                'brand': wanted[txt],
                'eman_group': txt,
                'url': absolute(
                    a['href'],
                    HOME
                )
            }

    missing = (
        set(wanted)
        - set(found)
    )

    if missing:
        raise RuntimeError(
            'Cannot discover Eman group URLs: '
            f'{sorted(missing)}'
        )

    return list(
        found.values()
    )


# =========================================================
# FIND PRODUCT CARDS
# =========================================================

def find_product_cards(
    s: BeautifulSoup
):

    cards = []

    for h in s.find_all(
        ['h2', 'h3', 'h4']
    ):

        a = h.find(
            'a',
            href=True
        )

        if not a:
            continue

        name = clean(
            a.get_text(
                ' ',
                strip=True
            )
        )

        href = absolute(
            a['href'],
            BASE
        )

        if (
            not name
            or '/product/' not in href
            or '/list/' in href
        ):
            continue

        block = h

        for _ in range(6):

            if (
                block
                and block.find('img')
                and block.find(
                    string=re.compile(
                        r'(so‘m|сум|сўм|UZS)',
                        re.I
                    )
                )
            ):
                break

            block = (
                block.parent
                if block
                else None
            )

        cards.append(
            (
                name,
                href,
                block or h
            )
        )

    # Dedupe repeated mobile/desktop markup
    out = []
    seen = set()

    for item in cards:

        if item[1] not in seen:

            seen.add(
                item[1]
            )

            out.append(
                item
            )

    return out


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

        s = soup(url)

    except Exception:

        return {
            'sku': '',
            'name': fallback_name,
            'image_url': '',
            'price': fallback_price,
            'extra': {}
        }


    text = clean(
        s.get_text(
            ' ',
            strip=True
        )
    )


    # -----------------------------------------------------
    # НАЗВАНИЕ
    # -----------------------------------------------------

    name = fallback_name

    h1 = s.find('h1')

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
    # АРТИКУЛ EMAN
    # -----------------------------------------------------

    sku = ''


    # Eman показывает артикул как:
    #
    # Артикул: L-1272-1
    # Артикул L-1272-1
    #
    # Забираем только само значение артикула,
    # не захватывая текст следующего блока.

    sku_match = re.search(
        r'\bАртикул\b\s*[:№]?\s*'
        r'([A-Za-zА-Яа-я0-9]'
        r'[A-Za-zА-Яа-я0-9._/\-]*)',
        text,
        re.I
    )

    if sku_match:

        sku = clean(
            sku_match.group(1)
        )


    # -----------------------------------------------------
    # ЦЕНА
    # -----------------------------------------------------

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

    price = (
        max(prices)
        if prices
        else fallback_price
    )


    # -----------------------------------------------------
    # ФОТО
    # -----------------------------------------------------

    # Eman хранит фотографии товаров в:
    #
    # https://www.eman.uz/media/product_images/...
    #
    # Поэтому ищем именно такие URL в HTML страницы.
    # Другие изображения вообще не используем.

    image_candidates = []

    html = html_module.unescape(
        str(s)
    )


    # Абсолютные URL

    absolute_matches = re.findall(
        r'https://www\.eman\.uz/media/product_images/[^"\')\s<>]+',
        html,
        flags=re.I
    )


    # Относительные URL

    relative_matches = re.findall(
        r'/media/product_images/[^"\')\s<>]+',
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
                url
            )


        # Убираем возможные HTML-хвосты

        image_url = image_url.split('"')[0]
        image_url = image_url.split("'")[0]
        image_url = image_url.split(')')[0]


        if image_url not in image_candidates:

            image_candidates.append(
                image_url
            )


    # -----------------------------------------------------
    # ПРОВЕРКА ФОТО
    # -----------------------------------------------------

    images = []

    for image_url in image_candidates:

        if not image_url:
            continue

        low = image_url.lower()

        blocked = (
            'logo',
            'icon',
            'sprite',
            'placeholder',
            'flag',
            'language'
        )

        if any(
            item in low
            for item in blocked
        ):
            continue

        if image_url not in images:

            images.append(
                image_url
            )


    # Первое изображение становится главным.
    # Если не нашли — оставляем пусто.

    main_image = (
        images[0]
        if images
        else ''
    )


    # -----------------------------------------------------
    # EXTRA
    # -----------------------------------------------------

    # Eman-характеристики автоматически НЕ импортируем.
    # Их будем заполнять вручную через YECHIM Dashboard.

    extra = {}


    return {
        'sku': sku,
        'name': name,
        'image_url': main_image,
        'price': price,
        'extra': extra
    }


# =========================================================
# PARSE LIST PAGE
# =========================================================

def parse_list_page(
    url: str,
    brand: str,
    group: str
):

    s = soup(url)

    results = []

    for name, href, block in find_product_cards(s):

        text = clean(
            block.get_text(
                ' ',
                strip=True
            )
        )

        image = ''

        if block:

            img = block.find('img')

            if img:

                image = absolute(
                    img.get('src')
                    or img.get('data-src')
                    or '',
                    url
                )


        price_match = re.search(
            r'([0-9][0-9\s\u00a0.,]*)\s*'
            r'(?:so‘m|so\s*m|сум|сўм)',
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


        d = parse_detail(
            href,
            name,
            image,
            price
        )


        # The source URL path is stable
        # and is used as the Supabase primary key.

        eman_id = urlparse(
            href
        ).path.rstrip('/')


        results.append(
            Product(
                eman_id,
                href,
                d['sku'],
                d['name'],
                brand,
                group,
                group,
                d['price'],
                'UZS',
                d['image_url'],
                d['extra']
            )
        )


    return results


# =========================================================
# NEXT PAGE
# =========================================================

def next_page(
    s: BeautifulSoup,
    current_url: str
):

    for a in s.find_all(
        'a',
        href=True
    ):

        txt = clean(
            a.get_text(
                ' ',
                strip=True
            )
        )

        if txt in {
            '>',
            'Следующая',
            'Next'
        }:

            return absolute(
                a['href'],
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
    url = cfg['url']
    visited = set()


    while (
        url
        and url not in visited
    ):

        visited.add(
            url
        )

        s = soup(url)


        for name, href, block in find_product_cards(s):

            text = clean(
                block.get_text(
                    ' ',
                    strip=True
                )
            )

            image = ''

            img = (
                block.find('img')
                if block
                else None
            )

            if img:

                image = absolute(
                    img.get('src')
                    or img.get('data-src')
                    or '',
                    url
                )


            price_match = re.search(
                r'([0-9][0-9\s\u00a0.,]*)\s*'
                r'(?:so‘m|so\s*m|сум|сўм)',
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


            # Pull SKU + richer fields
            # from each detail page.

            d = parse_detail(
                href,
                name,
                image,
                price
            )


            items.append(
                Product(
                    urlparse(
                        href
                    ).path.rstrip('/'),

                    href,

                    d['sku'],

                    d['name'],

                    cfg['brand'],

                    cfg['eman_group'],

                    cfg['eman_group'],

                    d['price'],

                    'UZS',

                    d['image_url'],

                    d['extra']
                )
            )


        url = next_page(
            s,
            url
        )

        time.sleep(0.5)


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
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer":
            "resolution=merge-duplicates,"
            "return=minimal"
    }


    rows = [

        {
            'eman_id': p.eman_id,
            'source_url': p.source_url,
            'sku': p.sku,
            'name': p.name,
            'brand': p.brand,
            'eman_group': p.eman_group,
            'category': p.category,
            'price': p.price,
            'currency': p.currency,
            'image_url': p.image_url,
            'extra': p.extra,
            'synced_at':
                datetime.now(
                    timezone.utc
                ).isoformat()
        }

        for p in products

    ]


    for i in range(
        0,
        len(rows),
        500
    ):

        r = requests.post(
            endpoint,
            headers=headers,
            json=rows[i:i + 500],
            timeout=60
        )

        r.raise_for_status()


# =========================================================
# MAIN
# =========================================================

def main():

    for env in (
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
    ):

        if not os.getenv(env):

            raise RuntimeError(
                f'Missing {env}'
            )


    groups = (
        discover_group_links()
    )


    all_products = []


    for cfg in groups:

        print(
            f"Syncing "
            f"{cfg['brand']} "
            f"← "
            f"{cfg['url']}"
        )

        all_products.extend(
            fetch_group(cfg)
        )


    # Dedupe by source path.

    unique = {
        p.eman_id: p
        for p in all_products
    }


    products = list(
        unique.values()
    )


    # Write to Supabase.

    supabase_upsert(
        products
    )


    # Write fallback snapshot.

    OUT.write_text(
        json.dumps(
            {
                'generated_at':
                    datetime.now()
                    .astimezone()
                    .isoformat(),

                'source':
                    BASE,

                'products':
                    [
                        asdict(p)
                        | {
                            'id':
                                p.eman_id,

                            'published':
                                False
                        }

                        for p in products
                    ]
            },
            ensure_ascii=False,
            indent=2
        ),
        encoding='utf-8'
    )


    print(
        f'Synced '
        f'{len(products)} '
        f'products into Supabase '
        f'and wrote fallback snapshot.'
    )


if __name__ == '__main__':
    main()
