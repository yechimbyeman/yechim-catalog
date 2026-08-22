const CONFIG = window.YECHIM_CONFIG || {};

const SUPABASE_READY = Boolean(
  window.supabase &&
  CONFIG.supabaseUrl &&
  !CONFIG.supabaseUrl.includes('YOUR_PROJECT') &&
  CONFIG.supabaseAnonKey &&
  !CONFIG.supabaseAnonKey.includes('YOUR_')
);

const db = SUPABASE_READY
  ? window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    )
  : null;

const state = {
  products: [],
  loading: true,
  query: '',
  selectedBrand: null,
  selectedCategory: null,
  productId: null
};

const CART_KEY = 'yechim_cart_v2';

let cart = {};

try {
  cart = JSON.parse(
    localStorage.getItem(CART_KEY) || '{}'
  );
} catch {
  cart = {};
}

/* =========================
   BRAND PRESENTATION
========================= */

const BRANDS = {
  'STARAX': {
    logo: './assets/brands/STARAX.png',
    background: './assets/backgrounds/STARAX BACKGROUND.jpg',
    title: 'STARAX',
    description:
      'Системы хранения и механизмы для кухни, гардеробных и другой мебели.'
  },

  'SAMET': {
    logo: './assets/brands/SAMET.png',
    background: './assets/backgrounds/SAMET BACKGROUND.webp',
    title: 'SAMET',
    description:
      'Петли, направляющие и механизмы для современной мебели.'
  },

  'CEBI': {
    logo: './assets/brands/CEBI.png',
    background: './assets/backgrounds/CEBI BACKGROUND.png',
    title: 'CEBI',
    description:
      'Мебельные ручки и крючки для стильных мебельных решений.'
  },

  'MESAN': {
    logo: './assets/brands/MESAN.png',
    background: './assets/backgrounds/MESAN BACKGROUND.webp',
    title: 'MESAN',
    description:
      'Крепёж и соединительные решения для производства мебели.'
  },

  'YECHIM LIGHTING': {
    logo: './assets/brands/YECHIM LIGHTING.png',
    background:
      './assets/backgrounds/YECHIM LIGHTING BACKGROUND.jpg',
    title: 'YECHIM LIGHTING',
    description:
      'Мебельная подсветка и световые решения для современной мебели.'
  }
};

/* =========================
   HELPERS
========================= */

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[c])
  );

const money = (v) =>
  Number(v || 0).toLocaleString('ru-RU') + ' сум';

const normalize = (x) =>
  String(x ?? '').toLowerCase().trim();

const productUrl = (id) =>
  `?product=${encodeURIComponent(id)}`;

function saveCart() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );

  updateCartBadge();
}

function cartQty() {

  return Object.values(cart)
    .reduce(
      (total, quantity) =>
        total + Number(quantity || 0),
      0
    );
}

function updateCartBadge() {

  const el =
    document.querySelector('#cartCount');

  if (el) {
    el.textContent = cartQty();
  }
}

/* =========================
   ROUTER
========================= */

function readRoute() {

  const params =
    new URLSearchParams(
      location.search
    );

  return {
    product: params.get('product'),
    brand: params.get('brand'),
    category: params.get('category')
  };
}

function renderRoute() {

  const route =
    readRoute();

  state.productId =
    route.product;

  state.selectedBrand =
    route.brand;

  state.selectedCategory =
    route.category;

  if (route.product) {

    renderDetail();

  } else if (
    route.brand &&
    route.category
  ) {

    renderCategoryProducts();

  } else if (route.brand) {

    renderBrandCategories();

  } else {

    renderHome();
  }
}

window.addEventListener(
  'popstate',
  renderRoute
);

/* =========================
   DATA
========================= */

async function loadProducts() {

  try {

    if (db) {

      const {
        data,
        error
      } = await db.rpc(
        'get_public_catalog'
      );

      if (error) {
        throw error;
      }

      state.products =
        (data || []).map((p) => ({
          id: p.eman_id,
          eman_id: p.eman_id,
          source_url: p.source_url,

          sku: p.yechim_sku || p.sku || '',

          name: p.name,

          brand: p.brand,

          category:
            p.category || 'Без категории',

          subcategory:
            p.subcategory || '',

          price: p.price,

          currency: p.currency,

          image: p.image_url,

          description:
            p.description,

          specs:
            p.specs || {},

          mounting_scheme:
            p.mounting_scheme_url,

          additional_images:
            p.additional_images || [],

          badge:
            p.badge,

          sort_order:
            p.sort_order || 0
        }));

    } else {

      const r =
        await fetch(
          'data/products.json'
        );

      const raw =
        await r.json();

      state.products =
        raw.products || [];
    }

  } catch (e) {

    state.products = [];

    document.querySelector(
      '#app'
    ).innerHTML = `
      <div class="shell">
        <div class="panel error">
          <b>
            Каталог временно недоступен.
          </b>

          <div class="muted">
            ${esc(
              e.message || e
            )}
          </div>
        </div>
      </div>
    `;

  } finally {

    state.loading = false;
  }
}

/* =========================
   CART
========================= */

function add(id, delta = 1) {

  const key = String(id);

  const current =
    Number(cart[key] || 0);

  const next =
    current +
    Number(delta || 0);

  if (next <= 0) {
    delete cart[key];
  } else {
    cart[key] = next;
  }

  saveCart();

  if (
    state.productId
  ) {
    renderDetail();
  } else {
    renderRoute();
  }
}

function clearCart() {

  cart = {};

  saveCart();

  renderCart();
}

/* =========================
   HOME
========================= */

function renderHome() {

  state.productId = null;

  document.title =
    'YECHIM — Решения для вашей мебели';

  const popular =
    state.products
      .filter((p) =>
        normalize(p.badge)
          .includes('популяр')
      )
      .slice(0, 8);

  const newProducts =
    state.products
      .filter((p) =>
        normalize(p.badge)
          .includes('нов')
      )
      .slice(0, 8);

  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <section class="catalog-head">

        <div>

          <h1>
            Каталог
          </h1>

          <p class="muted">
            Решения для вашей мебели
          </p>

        </div>

        <div class="search wide">

          <input
            id="q"
            placeholder="Найти товар или артикул"
          >

          <button
            class="btn btn-primary"
            id="searchBtn"
            type="button"
          >
            Найти
          </button>

        </div>

      </section>


      <section>

        <div class="section-head">

          <h2>
            Бренды
          </h2>

        </div>

        <div class="brand-grid">

          ${Object.entries(
            BRANDS
          )
            .map(
              ([brand, data]) => `

                <article
                  class="brand-card"
                  data-brand="${esc(brand)}"
                >

                  <div
                    class="brand-visual"
                    style="
                      background-image:
                        url('${data.background}');
                    "
                  >

                    <img
                      class="brand-logo"
                      src="${data.logo}"
                      alt="${esc(
                        data.title
                      )}"
                    >

                  </div>

                  <div
                    class="brand-description"
                  >

                    <div
                      class="brand-description-title"
                    >
                      ${esc(
                        data.title
                      )}
                    </div>

                    <div
                      class="brand-description-text"
                    >
                      ${esc(
                        data.description
                      )}
                    </div>

                    <span
                      class="brand-arrow"
                    >
                      Смотреть категории →
                    </span>

                  </div>

                </article>
              `
            )
            .join('')}

        </div>

      </section>


      ${
        popular.length
          ? `

            <section>

              <div class="section-head">

                <h2>
                  Популярные решения
                </h2>

              </div>

              <div class="products">

                ${popular
                  .map(productCard)
                  .join('')}

              </div>

            </section>

          `
          : ''
      }


      ${
        newProducts.length
          ? `

            <section>

              <div class="section-head">

                <h2>
                  Новинки
                </h2>

              </div>

              <div class="products">

                ${newProducts
                  .map(productCard)
                  .join('')}

              </div>

            </section>

          `
          : ''
      }


      <section
        class="home-promo"
      >

        <div>

          <h2>
            Найдите нужное решение
          </h2>

          <p>
            Ищите товар по названию
            или артикулу и отправляйте
            заявку менеджеру прямо
            из каталога.
          </p>

        </div>

        <div
          class="home-promo-stat"
        >
          ${state.products.length}
          товаров в каталоге
        </div>

      </section>

    </div>
  `;

  const searchInput =
    document.querySelector('#q');

  document.querySelector(
    '#searchBtn'
  ).onclick = () => {

    state.query =
      searchInput.value.trim();

    renderSearchResults();
  };

  searchInput.onkeydown = (
    event
  ) => {

    if (event.key === 'Enter') {

      state.query =
        event.target.value.trim();

      renderSearchResults();
    }
  };

  document
    .querySelectorAll(
      '[data-brand]'
    )
    .forEach((card) => {

      card.onclick = () => {

        history.pushState(
          {},
          '',
          `?brand=${encodeURIComponent(
            card.dataset.brand
          )}`
        );

        renderRoute();
      };
    });

  updateCartBadge();
}

/* =========================
   BRAND CATEGORIES
========================= */

function renderBrandCategories() {

  const brand =
    state.selectedBrand;

  const products =
    state.products.filter(
      (p) =>
        normalize(p.brand) ===
        normalize(brand)
    );

  const categories =
    [
      ...new Set(
        products
          .map(
            (p) =>
              p.category
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        String(a).localeCompare(
          String(b),
          'ru'
        )
    );

  document.title =
    `YECHIM — ${brand}`;

  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <div class="breadcrumbs">

        <a
          href="./"
          id="backHome"
        >
          Каталог
        </a>

        <span>›</span>

        <b>
          ${esc(brand)}
        </b>

      </div>

      <div class="section-head">

        <h1>
          ${esc(brand)}
        </h1>

        <button
          class="btn btn-ghost"
          id="backBrand"
          type="button"
        >
          Назад
        </button>

      </div>

      <p class="muted">
        Категории товаров
      </p>

      <section
        class="category-grid"
      >

        ${
          categories.length
            ? categories
                .map(
                  (category) => {

                    const count =
                      products.filter(
                        (p) =>
                          normalize(
                            p.category
                          ) ===
                          normalize(
                            category
                          )
                      ).length;

                    return `
                      <button
                        class="category-card"
                        data-category="${esc(
                          category
                        )}"
                        type="button"
                      >

                        <div
                          class="category-card-title"
                        >
                          ${esc(
                            category
                          )}
                        </div>

                        <div
                          class="category-card-count"
                        >
                          ${count}
                          ${
                            count === 1
                              ? 'товар'
                              : 'товаров'
                          }
                        </div>

                      </button>
                    `;
                  }
                )
                .join('')
            : `
              <div class="panel">

                <b>
                  Категории пока не определены.
                </b>

                <div class="muted">

                  Для этого бренда
                  в текущем источнике
                  ещё нет детальной категории.

                </div>

              </div>
            `
        }

      </section>

    </div>
  `;

  document.querySelector(
    '#backHome'
  ).onclick = (event) => {

    event.preventDefault();

    history.pushState(
      {},
      '',
      './'
    );

    renderRoute();
  };

  document.querySelector(
    '#backBrand'
  ).onclick = () => {

    history.pushState(
      {},
      '',
      './'
    );

    renderRoute();
  };

  document
    .querySelectorAll(
      '[data-category]'
    )
    .forEach((button) => {

      button.onclick = () => {

        history.pushState(
          {},
          '',
          `?brand=${encodeURIComponent(
            brand
          )}&category=${encodeURIComponent(
            button.dataset.category
          )}`
        );

        renderRoute();
      };
    });

  updateCartBadge();
}

/* =========================
   CATEGORY PRODUCTS
========================= */

function renderCategoryProducts() {

  const brand =
    state.selectedBrand;

  const category =
    state.selectedCategory;

  const products =
    state.products.filter(
      (p) =>
        normalize(p.brand) ===
          normalize(brand) &&
        normalize(p.category) ===
          normalize(category)
    );

  document.title =
    `YECHIM — ${category}`;

  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <div class="breadcrumbs">

        <a
          href="./"
          id="categoryHome"
        >
          Каталог
        </a>

        <span>›</span>

        <a
          href="#"
          id="categoryBrand"
        >
          ${esc(brand)}
        </a>

        <span>›</span>

        <b>
          ${esc(category)}
        </b>

      </div>

      <div class="section-head">

        <div>

          <div class="eyebrow">
            ${esc(brand)}
          </div>

          <h1>
            ${esc(category)}
          </h1>

        </div>

        <button
          class="btn btn-ghost"
          id="backToCategories"
          type="button"
        >
          Категории
        </button>

      </div>

      <section
        class="products"
      >

        ${
          products.length
            ? products
                .map(productCard)
                .join('')
            : `
              <div class="panel">

                <b>
                  В этой категории пока
                  нет опубликованных товаров.
                </b>

              </div>
            `
        }

      </section>

    </div>
  `;

  document.querySelector(
    '#categoryHome'
  ).onclick = (event) => {

    event.preventDefault();

    history.pushState(
      {},
      '',
      './'
    );

    renderRoute();
  };

  document.querySelector(
    '#categoryBrand'
  ).onclick = (event) => {

    event.preventDefault();

    history.pushState(
      {},
      '',
      `?brand=${encodeURIComponent(
        brand
      )}`
    );

    renderRoute();
  };

  document.querySelector(
    '#backToCategories'
  ).onclick = () => {

    history.pushState(
      {},
      '',
      `?brand=${encodeURIComponent(
        brand
      )}`
    );

    renderRoute();
  };

  updateCartBadge();
}

/* =========================
   SEARCH
========================= */

function renderSearchResults() {

  const q =
    normalize(state.query);

  const products =
    state.products.filter(
      (p) => {

        const haystack =
          [
            p.name,
            p.sku,
            p.brand,
            p.category,
            p.subcategory
          ]
            .filter(Boolean)
            .map(normalize)
            .join(' ');

        return (
          !q ||
          haystack.includes(q)
        );
      }
    );

  document.title =
    'YECHIM — Поиск';

  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <div class="breadcrumbs">

        <a
          href="./"
          id="searchHome"
        >
          Каталог
        </a>

        <span>›</span>

        <b>
          Поиск
        </b>

      </div>

      <section
        class="catalog-head"
      >

        <div>

          <h1>
            Поиск
          </h1>

          <p class="muted">
            Найдено:
            ${products.length}
          </p>

        </div>

        <div class="search wide">

          <input
            id="searchInput"
            value="${esc(
              state.query
            )}"
            placeholder="Название или артикул"
          >

          <button
            class="btn btn-primary"
            id="searchAgain"
            type="button"
          >
            Найти
          </button>

        </div>

      </section>

      <section
        class="products"
      >

        ${
          products.length
            ? products
                .map(productCard)
                .join('')
            : `
              <div class="panel">

                <b>
                  Ничего не найдено.
                </b>

                <div class="muted">
                  Попробуйте другой запрос.
                </div>

              </div>
            `
        }

      </section>

    </div>
  `;

  document.querySelector(
    '#searchHome'
  ).onclick = (event) => {

    event.preventDefault();

    history.pushState(
      {},
      '',
      './'
    );

    renderRoute();
  };

  const input =
    document.querySelector(
      '#searchInput'
    );

  const button =
    document.querySelector(
      '#searchAgain'
    );

  const runSearch = () => {

    state.query =
      input.value.trim();

    renderSearchResults();
  };

  button.onclick =
    runSearch;

  input.onkeydown =
    (event) => {

      if (event.key === 'Enter') {
        runSearch();
      }
    };

  updateCartBadge();
}

/* =========================
   PRODUCT CARD
========================= */

function productCard(p) {

  return `
    <article
      class="product"
    >

      <a
        class="product-link"
        href="${productUrl(p.id)}"
      >

        <div class="photo">

          ${
            p.image
              ? `
                <img
                  src="${esc(
                    p.image
                  )}"
                  alt="${esc(
                    p.name
                  )}"
                  loading="lazy"
                >
              `
              : `
                <span>
                  Фото товара
                </span>
              `
          }

        </div>

        <div
          class="product-body"
        >

          <div class="brand-mini">
            ${esc(p.brand)}
          </div>

          <h3>
            ${esc(p.name)}
          </h3>

          ${
            p.sku
              ? `
                <div class="sku">
                  Артикул:
                  ${esc(p.sku)}
                </div>
              `
              : ''
          }

          ${
            p.badge
              ? `
                <div class="badge">
                  ${esc(p.badge)}
                </div>
              `
              : ''
          }

          <div class="price">
            ${
              p.price
                ? money(p.price)
                : 'Цена уточняется'
            }
          </div>

        </div>

      </a>

      <div
        class="product-body"
        style="padding-top:0"
      >

        <div class="card-actions">

          <button
            class="btn btn-primary"
            type="button"
            data-add="${encodeURIComponent(
              p.id
            )}"
          >
            В корзину
          </button>

        </div>

      </div>

    </article>
  `;
}

/* =========================
   DETAIL
========================= */

function getProduct() {

  return state.products.find(
    (x) =>
      String(x.id) ===
      String(
        state.productId
      )
  );
}

function renderDetail() {

  const p =
    getProduct();

  if (!p) {
    return renderHome();
  }

  document.title =
    `YECHIM — ${p.name}`;

  const thumbs =
    [
      p.image,
      ...(p.additional_images || [])
    ]
      .filter(Boolean);

  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <div class="breadcrumbs">

        <a
          href="./"
          id="detailHome"
        >
          Каталог
        </a>

        <span>›</span>

        <span>
          ${esc(p.brand)}
        </span>

        <span>›</span>

        <b>
          ${esc(p.name)}
        </b>

      </div>

      <div class="detail">

        <div class="gallery">

          <div class="gallery-main">

            ${
              p.image
                ? `
                  <img
                    id="mainImage"
                    src="${esc(
                      p.image
                    )}"
                    alt="${esc(
                      p.name
                    )}"
                  >
                `
                : `
                  <span>
                    Фото товара
                  </span>
                `
            }

          </div>

          ${
            thumbs.length > 1
              ? `
                <div class="thumbs">

                  ${thumbs
                    .map(
                      (u, i) => `
                        <button
                          class="thumb ${
                            i === 0
                              ? 'active'
                              : ''
                          }"
                          data-img="${esc(
                            u
                          )}"
                          type="button"
                        >

                          <img
                            src="${esc(
                              u
                            )}"
                            alt=""
                          >

                        </button>
                      `
                    )
                    .join('')}

                </div>
              `
              : ''
          }

        </div>

        <div class="info">

          <div class="brand-mini">
            ${esc(p.brand)}
          </div>

          <h1>
            ${esc(p.name)}
          </h1>

          ${
            p.sku
              ? `
                <div class="sku">
                  Артикул:
                  ${esc(p.sku)}
                </div>
              `
              : ''
          }

          ${
            p.badge
              ? `
                <div class="badge">
                  ${esc(p.badge)}
                </div>
              `
              : ''
          }

          <div
            class="price detail-price"
          >
            ${
              p.price
                ? money(p.price)
                : 'Цена уточняется'
            }
          </div>

          <div class="buyline">

            <div class="qty">

              <button
                class="btn btn-ghost"
                id="minus"
                type="button"
              >
                −
              </button>

              <b>
                ${cart[p.id] || 0}
              </b>

              <button
                class="btn btn-ghost"
                id="plus"
                type="button"
              >
                +
              </button>

            </div>

            <button
              class="btn btn-primary grow-btn"
              id="addToCart"
              type="button"
            >
              В корзину
            </button>

            <button
              class="btn btn-ghost"
              id="share"
              type="button"
            >
              Поделиться
            </button>

          </div>

          ${
            p.description
              ? `
                <p class="description">
                  ${esc(
                    p.description
                  )}
                </p>
              `
              : ''
          }

          ${
            Object.keys(
              p.specs || {}
            ).length
              ? `
                <div class="specs">

                  ${Object.entries(
                    p.specs || {}
                  )
                    .map(
                      ([k, v]) => `
                        <div class="spec">

                          <b>
                            ${esc(k)}
                          </b>

                          <span>
                            ${esc(v)}
                          </span>

                        </div>
                      `
                    )
                    .join('')}

                </div>
              `
              : ''
          }

          ${
            p.mounting_scheme
              ? `
                <div
                  class="extra-block"
                >

                  <h3>
                    Схема присадки
                  </h3>

                  <a
                    href="${esc(
                      p.mounting_scheme
                    )}"
                    target="_blank"
                    rel="noopener"
                  >

                    <img
                      class="scheme"
                      src="${esc(
                        p.mounting_scheme
                      )}"
                      alt="Схема присадки"
                    >

                  </a>

                </div>
              `
              : ''
          }

        </div>

      </div>

    </div>
  `;

  document.querySelector(
    '#detailHome'
  ).onclick = (event) => {

    event.preventDefault();

    history.pushState(
      {},
      '',
      './'
    );

    renderRoute();
  };

  document
    .querySelectorAll('.thumb')
    .forEach((button) => {

      button.onclick = () => {

        const img =
          document.querySelector(
            '#mainImage'
          );

        if (img) {
          img.src =
            button.dataset.img;
        }

        document
          .querySelectorAll(
            '.thumb'
          )
          .forEach((x) =>
            x.classList.remove(
              'active'
            )
          );

        button.classList.add(
          'active'
        );
      };
    });

  document.querySelector(
    '#minus'
  ).onclick = () =>
    add(p.id, -1);

  document.querySelector(
    '#plus'
  ).onclick = () =>
    add(p.id, 1);

  document.querySelector(
    '#addToCart'
  ).onclick = () =>
    add(p.id, 1);

  document.querySelector(
    '#share'
  ).onclick =
    shareProduct;

  updateCartBadge();
}

/* =========================
   SHARE
========================= */

async function shareProduct() {

  const p =
    getProduct();

  const url =
    location.href;

  try {

    if (navigator.share) {

      await navigator.share({
        title:
          p?.name ||
          'YECHIM',

        text:
          p?.sku
            ? `Артикул ${p.sku}`
            : 'Товар YECHIM',

        url
      });

    } else {

      await navigator.clipboard
        .writeText(url);

      alert(
        'Ссылка на товар скопирована.'
      );
    }

  } catch {
    /* cancelled */
  }
}

/* =========================
   CART
========================= */

function renderCart() {

  const items =
    Object.entries(cart)
      .map(([id, quantity]) => ({
        p: state.products.find(
          (product) =>
            String(product.id) ===
            String(id)
        ),
        q:
          Number(quantity)
      }))
      .filter(
        (item) =>
          item.p &&
          item.q > 0
      );

  const old =
    document.querySelector(
      '.cart-drawer'
    );

  if (old) {
    old.remove();
  }

  const drawer =
    document.createElement(
      'aside'
    );

  drawer.className =
    'cart-drawer';

  drawer.innerHTML = `

    <div class="cart-head">

      <div>

        <h3>
          Корзина
        </h3>

        <span class="muted">
          ${items.length}
          ${
            items.length === 1
              ? 'позиция'
              : 'позиций'
          }
          ·
          ${cartQty()} шт.
        </span>

      </div>

      <div
        class="cart-head-actions"
      >

        ${
          items.length
            ? `
              <button
                class="btn btn-ghost"
                id="clearCart"
                type="button"
              >
                ×
              </button>
            `
            : ''
        }

        <button
          class="btn btn-ghost"
          id="closeCart"
          type="button"
        >
          Закрыть
        </button>

      </div>

    </div>

    ${
      items.length
        ? items
            .map(
              ({p, q}) => `

                <div class="cart-row">

                  <div>

                    <b>
                      ${esc(
                        p.brand
                      )}
                    </b>

                    <div>
                      ${esc(
                        p.name
                      )}
                    </div>

                    ${
                      p.sku
                        ? `
                          <div
                            class="muted"
                          >
                            ${esc(
                              p.sku
                            )}
                          </div>
                        `
                        : ''
                    }

                  </div>

                  <div
                    class="cart-item-actions"
                  >

                    <button
                      class="btn btn-ghost"
                      data-cart-minus="${encodeURIComponent(
                        p.id
                      )}"
                      type="button"
                    >
                      −
                    </button>

                    <b>
                      ${q}
                    </b>

                    <button
                      class="btn btn-ghost"
                      data-cart-plus="${encodeURIComponent(
                        p.id
                      )}"
                      type="button"
                    >
                      +
                    </button>

                  </div>

                </div>
              `
            )
            .join('')
        : `
          <div class="empty">
            Корзина пока пустая.
          </div>
        `
    }

    ${
      items.length
        ? `
          <div class="cart-actions">

            <button
              class="btn btn-primary"
              id="sendRequest"
              type="button"
            >
              Отправить заявку
            </button>

          </div>
        `
        : ''
    }

  `;

  document.body.append(
    drawer
  );

  drawer.querySelector(
    '#closeCart'
  ).onclick = () =>
    drawer.remove();

  const clearButton =
    drawer.querySelector(
      '#clearCart'
    );

  if (clearButton) {

    clearButton.onclick = () => {

      clearCart();

      updateCartBadge();
    };
  }

  drawer
    .querySelectorAll(
      '[data-cart-minus]'
    )
    .forEach((button) => {

      button.onclick = () => {

        add(
          decodeURIComponent(
            button.dataset.cartMinus
          ),
          -1
        );

        renderCart();
      };
    });

  drawer
    .querySelectorAll(
      '[data-cart-plus]'
    )
    .forEach((button) => {

      button.onclick = () => {

        add(
          decodeURIComponent(
            button.dataset.cartPlus
          ),
          1
        );

        renderCart();
      };
    });

  const sendButton =
    drawer.querySelector(
      '#sendRequest'
    );

  if (sendButton) {

    sendButton.onclick =
      sendRequest;
  }
}

async function loadXlsxLibrary() {
  if (window.XLSX) {
    return window.XLSX;
  }

  await new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-yechim-xlsx="true"]'
    );

    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener(
        'error',
        () => reject(
          new Error('Не удалось загрузить Excel-модуль.')
        ),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');

    script.src =
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

    script.async = true;
    script.dataset.yechimXlsx = 'true';

    script.onload = resolve;

    script.onerror = () =>
      reject(
        new Error(
          'Не удалось загрузить Excel-модуль. Проверьте подключение к интернету.'
        )
      );

    document.head.appendChild(script);
  });

  if (!window.XLSX) {
    throw new Error('Excel-модуль загрузился некорректно.');
  }

  return window.XLSX;
}


async function sendRequest() {

  const items =
    Object.entries(cart)
      .map(([id, quantity]) => ({
        p: state.products.find(
          (product) =>
            String(product.id) ===
            String(id)
        ),
        q: Number(quantity)
      }))
      .filter(
        (item) =>
          item.p &&
          item.q > 0
      );

  if (!items.length) {
    return;
  }

  /*
   * Группируем одинаковые артикулы.
   * Например:
   * A123 = 2
   * A123 = 3
   * превратится в:
   * A123 = 5
   */

  const rowsBySku = new Map();

  items.forEach(({ p, q }) => {

    const sku = String(
      p.sku ||
      p.name ||
      p.id
    ).trim();

    rowsBySku.set(
      sku,
      (rowsBySku.get(sku) || 0) + q
    );
  });


  /*
   * Создаём строки Excel
   */

  const rows = Array.from(
    rowsBySku,
    ([sku, quantity]) => ({
      'Артикул': sku,
      'Количество': quantity
    })
  );


  /*
   * Считаем общее количество
   */

  const total = rows.reduce(
    (sum, row) =>
      sum + Number(row['Количество'] || 0),
    0
  );


  /*
   * Добавляем Итого
   */

  rows.push({
    'Артикул': 'Итого',
    'Количество': total
  });


  try {

    const XLSX =
      await loadXlsxLibrary();


    /*
     * Создаём лист
     */

    const worksheet =
      XLSX.utils.json_to_sheet(rows);


    /*
     * Ширина колонок
     */

    worksheet['!cols'] = [
      { wch: 24 },
      { wch: 14 }
    ];


    /*
     * Создаём книгу
     */

    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Заявка'
    );


    /*
     * Имя файла
     */

    const now = new Date();

    const pad = (value) =>
      String(value).padStart(2, '0');

    const filename =
      `YECHIM_Request_${now.getFullYear()}-${pad(
        now.getMonth() + 1
      )}-${pad(
        now.getDate()
      )}_${pad(
        now.getHours()
      )}-${pad(
        now.getMinutes()
      )}.xlsx`;


    /*
     * Скачиваем Excel
     */

    XLSX.writeFile(
      workbook,
      filename
    );


    /*
     * После успешного создания файла
     * очищаем корзину
     */

    clearCart();

  } catch (error) {

    console.error(
      'Excel export error:',
      error
    );

    alert(
      error.message ||
      'Не удалось создать Excel-файл.'
    );
  }
}

    alert(
      'Список заявки скопирован. Укажите Telegram username менеджера в supabase-config.js.'
    );

    return;
  }



  clearCart();
}

/* =========================
   BUTTON: ADD TO CART
========================= */

document.addEventListener(
  'click',
  (event) => {

    const button =
      event.target.closest(
        '[data-add]'
      );

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    add(
      decodeURIComponent(
        button.dataset.add
      ),
      1
    );
  }
);
/* =========================
   INIT
========================= */

document.querySelector(
  '#cartButton'
).onclick =
  renderCart;

(async () => {

  await loadProducts();

  renderRoute();

  updateCartBadge();

})();
