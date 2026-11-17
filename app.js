/* =========================
   PUBLIC SITE LOCALIZATION
========================= */
const LANGUAGE_KEY = 'yechim_language';
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) === 'uz' ? 'uz' : 'ru';

const UI_TRANSLATIONS = {
'Каталог':'Katalog','Поиск по артикулу...':'Artikul bo‘yicha qidirish...','Поиск по артикулу…':'Artikul bo‘yicha qidirish…','Контакты':'Aloqa','Популярные решения':'Ommabop yechimlar','Товары с метками появятся здесь после назначения меток в Dashboard.':'Teglar Dashboard’da belgilanganidan so‘ng mahsulotlar shu yerda ko‘rinadi.',
'Артикул':'Artikul','Артикул:':'Artikul:','В корзину':'Savatga','Хит продаж':'Eng ko‘p sotilgan','Новинка':'Yangi','Новинки':'Yangi mahsulotlar','Скидка':'Chegirma','В наличии:':'Mavjud:','Нет в наличии':'Mavjud emas','Цена уточняется':'Narxni aniqlashtiring','Фото товара':'Mahsulot rasmi','Фильтры':'Filtrlar','Бренд':'Brend','Бренды':'Brendlar','Все бренды':'Barcha brendlar','Сбросить':'Tozalash',
'Найдено:':'Topildi:','Поиск':'Qidiruv','Название или артикул':'Nomi yoki artikul','Найти':'Qidirish','Найти товар или артикул':'Mahsulot yoki artikulni qidiring','Ничего не найдено.':'Hech narsa topilmadi.','Попробуйте другой запрос.':'Boshqa so‘rovni sinab ko‘ring.','Назад':'Orqaga','Далее':'Keyingi','Страница':'Sahifa','товаров':'ta mahsulot','У этого бренда пока нет опубликованных товаров.':'Bu brend uchun hozircha chop etilgan mahsulotlar yo‘q.',
'Поделиться':'Ulashish','Схема присадки':'Montaj sxemasi','Инструкция по сборке':'Yig‘ish bo‘yicha yo‘riqnoma','Открыть инструкцию по сборке в новой вкладке':'Yig‘ish yo‘riqnomasini yangi oynada ochish','Ссылка на товар скопирована.':'Mahsulot havolasi nusxalandi.','Корзина':'Savat','позиция':'mahsulot','позиций':'mahsulot','шт.':'dona','Закрыть':'Yopish','Корзина пока пустая.':'Savat hozircha bo‘sh.','Отправить заявку':'So‘rov yuborish','Количество':'Miqdor','Итого':'Jami',
'Каталог временно недоступен.':'Katalog vaqtincha mavjud emas.','Не удалось загрузить локальный каталог':'Mahalliy katalogni yuklab bo‘lmadi','Не удалось загрузить Excel-модуль.':'Excel modulini yuklab bo‘lmadi.','Не удалось загрузить Excel-модуль. Проверьте подключение к интернету.':'Excel modulini yuklab bo‘lmadi. Internetga ulanishni tekshiring.','Excel-модуль загрузился некорректно.':'Excel moduli noto‘g‘ri yuklandi.','Не удалось создать Excel-файл.':'Excel faylini yaratib bo‘lmadi.','Товар YECHIM':'YECHIM mahsuloti','YECHIM — Решения для вашей мебели':'YECHIM — Mebelingiz uchun yechimlar','YECHIM — Поиск':'YECHIM — Qidiruv','Решения для вашей мебели':'Mebelingiz uchun yechimlar','Смотреть товары →':'Mahsulotlarni ko‘rish →','Специально для вас':'Siz uchun maxsus','Категории товаров':'Mahsulot kategoriyalari','Категории':'Kategoriyalar','Категории пока не определены.':'Kategoriyalar hali aniqlanmagan.','В этой категории пока нет опубликованных товаров.':'Bu kategoriyada hozircha e’lon qilingan mahsulotlar yo‘q.','Для этого бренда в текущем источнике ещё нет детальной категории.':'Bu brend uchun hozircha batafsil kategoriya mavjud emas.',
'Системы хранения и механизмы для кухни, гардеробных и другой мебели.':'Oshxona, garderob va boshqa mebellar uchun saqlash tizimlari va mexanizmlar.','Мебельные ручки и крючки для стильных мебельных решений.':'Zamonaviy mebel yechimlari uchun mebel tutqichlari va ilgaklar.','Крепёж и соединительные решения для производства мебели.':'Mebel ishlab chiqarish uchun mahkamlash va biriktirish yechimlari.','Петли, направляющие и механизмы для современной мебели.':'Zamonaviy mebel uchun ilmoqlar, yo‘naltirgichlar va mexanizmlar.','Мебельная подсветка и световые решения для современной мебели.':'Zamonaviy mebel uchun yoritish tizimlari va yorug‘lik yechimlari.',
'Характеристики':'Xususiyatlar','Размер':'O‘lcham','Размеры':'O‘lchamlari','Ширина':'Eni','Высота':'Balandligi','Глубина':'Chuqurligi','Длина':'Uzunligi','Материал':'Material','Цвет':'Rang','Цвет изделия':'Mahsulot rangi','Тип':'Turi','Модель':'Model','Артикул товара':'Mahsulot artikuli','Производитель':'Ishlab chiqaruvchi','Страна производства':'Ishlab chiqarilgan mamlakat','Нагрузка':'Yuk ko‘tarish qobiliyati','Максимальная нагрузка':'Maksimal yuklama','Монтаж':'O‘rnatish','Способ монтажа':'O‘rnatish usuli','Покрытие':'Qoplama','Количество в упаковке':'Qadoqdagi soni','Толщина':'Qalinligi','Диаметр':'Diametri','Вес':'Vazni','Назначение':'Vazifasi','Комплектация':'To‘plam tarkibi','Мебельные ручки':'Mebel tutqichlari'
};

function translateTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  if (node.parentElement?.closest('.product h3,.info > h1,.product-name,h1.product-title,.brand-mini,.product-sku-value,.price,.sale-price,.old-price')) return;
  const original=node.nodeValue||'', value=original.trim(); if(!value) return;
  const reverse=Object.fromEntries(Object.entries(UI_TRANSLATIONS).map(([ru,uz])=>[uz,ru]));
  const dict=currentLanguage==='uz'?UI_TRANSLATIONS:reverse;
  let translated=dict[value];
  if(!translated) { const key=Object.keys(dict).sort((a,b)=>b.length-a.length).find(k=>value.startsWith(k)&&value.length>k.length&&/^[ :]/.test(value[k.length])); if(key) translated=dict[key]+value.slice(key.length); }
  if(translated&&translated!==value) node.nodeValue=original.replace(value,translated);
}

function applyPublicTranslations(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(translateTextNode);
  root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el => {
    for (const attr of ['placeholder','title','aria-label']) {
      const key='data-ru-'+attr, value=el.getAttribute(key)||el.getAttribute(attr);
      if(!value) continue;
      if(!el.hasAttribute(key)) el.setAttribute(key,value);
      const ru=el.getAttribute(key), reverse=Object.fromEntries(Object.entries(UI_TRANSLATIONS).map(([a,b])=>[b,a]));
      el.setAttribute(attr,currentLanguage==='uz'?(UI_TRANSLATIONS[ru]||ru):ru);
    }
  });
}

function setLanguage(language) {
  currentLanguage = language === 'uz' ? 'uz' : 'ru';
  localStorage.setItem(LANGUAGE_KEY, currentLanguage);
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll('#languageSwitcher .language-btn').forEach(btn => {
    const active = btn.dataset.lang === currentLanguage;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  renderRoute();
  applyPublicTranslations();
}

function initLanguageSwitcher() {
  const switcher = document.querySelector('#languageSwitcher');
  if (!switcher) return;
  switcher.innerHTML = '<button class="language-btn" type="button" data-lang="ru" aria-label="Русский">RU</button><span aria-hidden="true">|</span><button class="language-btn" type="button" data-lang="uz" aria-label="O‘zbekcha">UZ</button>';
  switcher.querySelectorAll('[data-lang]').forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.lang)));
  document.documentElement.lang = currentLanguage;
  switcher.querySelectorAll('.language-btn').forEach(btn => {
    const active = btn.dataset.lang === currentLanguage;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  applyPublicTranslations();
}

const publicTranslationObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') translateTextNode(record.target);
    record.addedNodes?.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) applyPublicTranslations(node);
    });
  }
});
publicTranslationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

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
  productId: null,
  catalogBrand: 'all',
  banners: [],
  brands: []
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
    background:
      './assets/backgrounds/STARAX BACKGROUND.jpg',
    title: 'STARAX',
    description:
      'Системы хранения и механизмы для кухни, гардеробных и другой мебели.'
  },

  'SAMET': {
    logo: './assets/brands/SAMET.png',
    background:
      './assets/backgrounds/SAMET BACKGROUND.webp',
    title: 'SAMET',
    description:
      'Петли, направляющие и механизмы для современной мебели.'
  },

  'CEBI': {
    logo: './assets/brands/CEBI.png',
    background:
      './assets/backgrounds/CEBI BACKGROUND.png',
    title: 'CEBI',
    description:
      'Мебельные ручки и крючки для стильных мебельных решений.'
  },

  'MESAN': {
    logo: './assets/brands/MESAN.png',
    background:
      './assets/backgrounds/MESAN BACKGROUND.webp',
    title: 'MESAN',
    description:
      'Крепёж и соединительные решения для производства мебели.'
  },

  'YECHIM LIGHTING': {
    logo:
      './assets/brands/YECHIM LIGHTING.png',
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
  Number(v || 0)
    .toLocaleString('ru-RU') +
  (currentLanguage === 'uz' ? ' so‘m' : ' сум');


const normalize = (x) =>
  String(x ?? '')
    .toLowerCase()
    .trim();


const productUrl = (id) =>
  `?product=${encodeURIComponent(id)}`;


/* =========================
   STOCK DISPLAY
========================= */

function stockMarkup(
  p,
  detail = false
) {

  if (
    p.stock_quantity === null ||
    p.stock_quantity === undefined ||
    p.stock_quantity === ''
  ) {

    return '';

  }


  const quantity = Number(
    p.stock_quantity
  );


  const unit =
    p.stock_unit ||
    'шт.';


  if (quantity > 0) {

    return `

      <div
        class="${
          detail
            ? 'stock-status stock-status-detail'
            : 'stock-status'
        } stock-in"
      >

        <span class="stock-dot">
          ✓
        </span>

        <span>

          В наличии:

          <b>
            ${esc(
              quantity.toLocaleString(
                'ru-RU'
              )
            )}
          </b>

          ${esc(unit)}

        </span>

      </div>

    `;

  }


  return `

    <div
      class="${
        detail
          ? 'stock-status stock-status-detail'
          : 'stock-status'
      } stock-out"
    >

      <span class="stock-dot">
        ×
      </span>

      <span>
        Нет в наличии
      </span>

    </div>

  `;
}


/* =========================
   CART HELPERS
========================= */

function saveCart() {

  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart)
  );

  updateCartBadge();
}


function cartQty() {

  return Object.values(
    cart
  ).reduce(
    (total, quantity) =>
      total +
      Number(quantity || 0),
    0
  );

}


function updateCartBadge() {

  const el =
    document.querySelector(
      '#cartCount'
    );

  if (el) {

    el.textContent =
      cartQty();

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

    product:
      params.get('product'),
    catalog: params.get('catalog'),

    brand:
      params.get('brand'),

    page:
      Math.max(1, parseInt(params.get('page') || '1', 10) || 1)

  };

}


function renderRoute() {

  const route =
    readRoute();


  state.productId =
    route.product;


  state.selectedBrand =
    route.brand;


  state.currentPage =
    route.page;


  if (route.product) {

    renderDetail();

  } else if (route.catalog) {
    renderCatalog();

  } else if (
    route.brand
  ) {

    renderBrandProducts();

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

function mapCatalogProduct(p) {
  return {
    id: p.eman_id,
    eman_id: p.eman_id,
    source_url: p.source_url,
    sku: p.yechim_sku || p.sku || '',
    name: p.name,
    brand: p.brand,
    category: p.category || 'Без категории',
    subcategory: p.subcategory || '',
    price: p.price,
    currency: p.currency,
    image: p.image_url,
    stock_quantity: p.stock_quantity !== null && p.stock_quantity !== undefined ? p.stock_quantity : null,
    stock_unit: p.stock_unit || 'шт.',
    stock_locations: p.stock_locations || [],
    description: p.description,
    specs: p.specs || {},
    specs_ru: p.specs_ru || p.specsRu || p.characteristics_ru || p.characteristicsRu || null,
    specs_uz: p.specs_uz || p.specsUz || p.characteristics_uz || p.characteristicsUz || null,
    mounting_scheme: p.mounting_scheme_url,
    additional_images: p.additional_images || [],
    badge: '',
    product_tags: p.product_tags || [],
    is_featured: Boolean(p.is_featured),
    discount_percent: Number(p.discount_percent || 0),
    sort_order: p.sort_order || 0
  };
}

async function loadRemainingProducts(initialCount, pageSize = 250) {
  if (!db) return;
  let offset = initialCount;
  let loaded = 0;

  try {
    while (true) {
      const { data: page, error } = await db
        .rpc('get_public_catalog')
        .order('is_featured', { ascending: false })
        .order('product_tags', { ascending: false })
        .order('sort_order', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      const rows = page || [];
      if (!rows.length) break;

      const existing = new Set(state.products.map(p => String(p.id)));
      for (const row of rows) {
        if (!existing.has(String(row.eman_id))) {
          state.products.push(mapCatalogProduct(row));
          existing.add(String(row.eman_id));
        }
      }

      loaded += rows.length;
      offset += rows.length;
      if (rows.length < pageSize) break;
    }

    console.info(`YECHIM background catalog loaded: ${loaded} additional products`);

    const route = readRoute();
    if (route.catalog || route.brand) renderRoute();
  } catch (error) {
    console.warn('YECHIM background catalog load failed:', error);
  }
}

async function loadProducts() {
  try {
    if (db) {
      const pageSize = 250;
      const [productResult, bannerResult, brandResult] = await Promise.all([
        db.rpc('get_public_catalog')
          .order('is_featured', { ascending: false })
          .order('product_tags', { ascending: false })
          .order('sort_order', { ascending: true })
          .range(0, pageSize - 1),
        db.from('yechim_banners').select('*').eq('active', true).order('sort_order'),
        db.from('yechim_brands').select('*').eq('active', true).order('sort_order').order('name')
      ]);

      if (productResult.error) throw productResult.error;
      state.products = (productResult.data || []).map(mapCatalogProduct);
      state.banners = bannerResult.data || [];
      if (!brandResult.error && brandResult.data) state.brands = brandResult.data;

      console.info(`YECHIM priority catalog loaded: ${state.products.length} products`);
      state.loading = false;
      // Fetch the remaining products only after the first screen has rendered.
      setTimeout(() => loadRemainingProducts(state.products.length, pageSize), 0);
    } else {
      const response = await fetch('data/products.json');
      if (!response.ok) throw new Error('Не удалось загрузить локальный каталог');
      const raw = await response.json();
      state.products = (raw.products || []).map(p => ({
        ...p,
        stock_quantity: p.stock_quantity !== null && p.stock_quantity !== undefined ? p.stock_quantity : null,
        stock_unit: p.stock_unit || 'шт.',
        stock_locations: p.stock_locations || []
      }));
    }
  } catch (error) {
    state.products = [];
    document.querySelector('#app').innerHTML = `
      <div class="shell">
        <div class="panel error">
          <b>Каталог временно недоступен.</b>
          <div class="muted">${esc(error.message || error)}</div>
        </div>
      </div>`;
  } finally {
    state.loading = false;
  }
}

/* =========================
   CART
========================= */

function add(
  id,
  delta = 1
) {

  const key =
    String(id);


  const current =
    Number(
      cart[key] || 0
    );


  const next =
    current +
    Number(delta || 0);


  if (next <= 0) {

    delete cart[key];

  } else {

    cart[key] =
      next;

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

  state.productId =
    null;


  document.title =
    'YECHIM — Решения для вашей мебели';


  const popular = state.products
    .filter(p => {
      const tags = Array.isArray(p.product_tags)
        ? p.product_tags
        : (typeof p.product_tags === 'string' ? p.product_tags.replace(/[{}]/g, '').split(',').filter(Boolean) : []);
      return tags.length > 0 || p.is_featured === true;
    })
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const brandItems = Object.entries(BRANDS).map(([name, brand]) => {
    const saved = state.brands.find(item => normalize(item.name) === normalize(name));
    return { name, image_url: saved?.image_url || brand.logo };
  });


  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell home-shell">
      ${state.banners && state.banners.length ? state.banners.filter(b=>b.active!==false).slice(0,1).map(b=>'<section class="hero-banner" aria-label="Баннер" style="background-image:url(\''+esc(b.image_url)+'\')">'+(b.button_text?'<a class="hero-cta" href="'+esc(b.link_url || '?catalog=1')+'">'+esc(b.button_text)+' <span aria-hidden="true">→</span></a>':'')+'</section>').join('') : ''}





      <section class="home-brands" aria-label="Бренды">
        <div class="brand-grid">
          ${brandItems.map(b => `<button class="brand-tile" type="button" data-brand="${esc(b.name)}" aria-label="Открыть ассортимент ${esc(b.name)}">${b.image_url ? `<img class="brand-logo" src="${esc(b.image_url)}" alt="${esc(b.name)}" loading="lazy">` : `<span>${esc(b.name)}</span>`}</button>`).join("")}
        </div>
      </section>


      ${
        true
          ? `

            <section>

              <div
                class="section-head"
              >

                <h2>
                  Популярные решения
                </h2>

              </div>


              <div
                class="products"
              >

                ${popular.length ? popular.map(p => productCard(p, { compact: true })).join('') : '<div class="muted home-no-tagged">Товары с метками появятся здесь после назначения меток в Dashboard.</div>'}

              </div>

            </section>

          `
          : ''
      }






    </div>

  `;


  document
    .querySelectorAll(
      '[data-brand]'
    )
    .forEach(
      (card) => {

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

      }
    );


  updateCartBadge();

}

function renderCatalog() {
  const brands = [...new Set(state.products.map(p => p.brand).filter(Boolean))].sort();
  const q = normalize(state.query);
  const list = state.products.filter(p => (!q || [p.name,p.sku,p.brand].some(v => normalize(v).includes(q))) && (state.catalogBrand === 'all' || p.brand === state.catalogBrand));
  document.querySelector('#app').innerHTML = '<div class="shell"><div class="section-head"><h1>Каталог</h1><span class="muted">Найдено: '+list.length+'</span></div><div class="catalog-layout"><aside class="catalog-filters panel"><b>Фильтры</b><label>Бренд<select id="catalogBrand"><option value="all">Все бренды</option>'+brands.map(b=>'<option value="'+esc(b)+'" '+(state.catalogBrand===b?'selected':'')+'>'+esc(b)+'</option>').join('')+'</select></label><button id="resetCatalog" class="btn btn-ghost">Сбросить</button></aside><div class="catalog-results"><div class="products">'+list.map(productCard).join('')+'</div></div></div></div>';
  document.querySelector('#catalogBrand').onchange=e=>{state.catalogBrand=e.target.value;renderCatalog()};
  document.querySelector('#resetCatalog').onclick=()=>{state.catalogBrand='all';state.query='';renderCatalog()};
  updateCartBadge();
}


/* =========================
   BRAND PRODUCTS
========================= */

function renderBrandProducts() {
  const brand = state.selectedBrand;
  const pageSize = 24;
  const products = state.products.filter((p) =>
    normalize(p.brand) === normalize(brand)
  );
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const page = Math.min(Math.max(1, Number(state.currentPage || 1)), pageCount);
  const visible = products.slice((page - 1) * pageSize, page * pageSize);

  document.title = `YECHIM — ${brand}`;

  document.querySelector('#app').innerHTML = `
    <div class="shell">
      <div class="breadcrumbs">
        <a href="./" id="backHome">Каталог</a><span>›</span><b>${esc(brand)}</b>
      </div>

      <div class="section-head brand-products-head">
        <div>
          <h1>${esc(brand)}</h1>
          <p class="muted">${products.length.toLocaleString('ru-RU')} товаров</p>
        </div>
        <button class="btn btn-ghost" id="backBrand" type="button">Назад</button>
      </div>

      <section class="products">
        ${visible.length ? visible.map(productCard).join('') : `
          <div class="panel"><b>У этого бренда пока нет опубликованных товаров.</b></div>
        `}
      </section>

      ${pageCount > 1 ? `
        <nav class="pagination" aria-label="Страницы каталога">
          <button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Назад</button>
          <span>Страница ${page} из ${pageCount}</span>
          <button class="page-btn" data-page="${page + 1}" ${page >= pageCount ? 'disabled' : ''}>Далее</button>
        </nav>
      ` : ''}
    </div>
  `;

  const goHome = (event) => {
    event.preventDefault();
    history.pushState({}, '', './');
    renderRoute();
  };
  document.querySelector('#backHome').onclick = goHome;
  document.querySelector('#backBrand').onclick = goHome;

  document.querySelectorAll('[data-page]').forEach((button) => {
    button.onclick = () => {
      const nextPage = Number(button.dataset.page);
      if (nextPage < 1 || nextPage > pageCount) return;
      history.pushState({}, '', `?brand=${encodeURIComponent(brand)}&page=${nextPage}`);
      renderRoute();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  updateCartBadge();
}


/* =========================
   SEARCH
========================= */

function renderSearchResults() {

  const q =
    normalize(
      state.query
    );


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
            .map(
              normalize
            )
            .join(' ');


        return (
          !q ||
          haystack.includes(
            q
          )
        );

      }
    );


  document.title =
    'YECHIM — Поиск';


  document.querySelector(
    '#app'
  ).innerHTML = `

    <div class="shell">

      <div
        class="breadcrumbs"
      >

        <a
          href="./"
          id="searchHome"
        >
          Каталог
        </a>

        <span>
          ›
        </span>

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


          <p
            class="muted"
          >
            Найдено:
            ${products.length}
          </p>

        </div>


        <div
          class="search wide"
        >

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
                .map(
                  productCard
                )
                .join('')

            : `

              <div
                class="panel"
              >

                <b>
                  Ничего не найдено.
                </b>


                <div
                  class="muted"
                >
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
  ).onclick = (
    event
  ) => {

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

      if (
        event.key ===
        'Enter'
      ) {

        runSearch();

      }

    };


  updateCartBadge();

}
function priceMarkup(p, detail = false) {
  const discount = Math.min(99, Math.max(0, Number(p.discount_percent || 0)));
  const original = Number(p.price || 0);
  if (!original) return '<span>Цена уточняется</span>';
  if (!discount) return money(original);
  const discounted = Math.round(original * (100 - discount) / 100);
  return `
    <span class="sale-price">${money(discounted)}</span>
    <span class="old-price">${money(original)}</span>
    <span class="discount-sticker">−${discount}%</span>
  `;
}


/* =========================
   PRODUCT CARD
========================= */

function productCard(p, options = {}) {
  const compact = options.compact === true;
  const tags = Array.isArray(p.product_tags) ? p.product_tags : [];
  const labels = currentLanguage === 'uz'
    ? { hit: 'Eng ko‘p sotilgan', new: 'Yangi', sale: 'Chegirma' }
    : { hit: 'Хит продаж', new: 'Новинка', sale: 'Скидка' };
  const tagMarkup = tags.map(t => labels[t] ? '<span class="product-tag tag-' + t + '">' + labels[t] + '</span>' : '').join('');
  return `
    <article class="product${compact ? " product-compact" : ""}">
      <a class="product-link" href="${productUrl(p.id)}">
        <div class="photo">
          ${tagMarkup ? `<div class="product-tags">${tagMarkup}</div>` : ''}
          ${Number(p.discount_percent || 0) > 0 ? `<span class="discount-sticker photo-discount">−${Math.min(99, Number(p.discount_percent))}%</span>` : ''}
          ${p.image
            ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
            : '<span>Фото товара</span>'}
        </div>
        <div class="product-body">
          <div class="brand-mini">${esc(p.brand || '')}</div>
          <div class="product-sku">
            <span class="product-sku-label">Артикул</span>
            <span class="product-sku-value">${p.sku ? esc(p.sku) : ''}</span>
          </div>
          <h3>${esc(p.name)}</h3>
          ${stockMarkup(p)}
          <div class="price ${Number(p.discount_percent || 0) > 0 ? 'price-sale' : ''}">
            ${priceMarkup(p)}
          </div>
        </div>
      </a>
      <div class="card-actions">
        <button class="btn btn-primary" type="button" data-add="${encodeURIComponent(p.id)}">В корзину</button>
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


function getLocalizedSpecs(product) {
  if (!product) return [];

  const hasContent = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(item => item && (
      (item.name !== undefined && item.value !== undefined) ||
      (Array.isArray(item) && item.length >= 2)
    ));
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return String(value).trim().length > 0;
  };

  const unwrap = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return hasContent(value) ? value : null;
    if ('ru' in value || 'uz' in value) {
      const preferred = value[currentLanguage];
      const fallback = value[currentLanguage === 'uz' ? 'ru' : 'uz'];
      return hasContent(preferred) ? preferred : (hasContent(fallback) ? fallback : null);
    }
    return hasContent(value) ? value : null;
  };

  const candidates = currentLanguage === 'uz'
    ? [
        product.specs_uz,
        product.specsUz,
        product.characteristics_uz,
        product.characteristicsUz,
        product.specs_ru,
        product.specsRu,
        product.characteristics_ru,
        product.characteristicsRu,
        product.specs
      ]
    : [
        product.specs_ru,
        product.specsRu,
        product.characteristics_ru,
        product.characteristicsRu,
        product.specs
      ];

  const rawSpecs = candidates.map(unwrap).find(hasContent);
  if (!rawSpecs) return [];

  if (Array.isArray(rawSpecs)) {
    return rawSpecs
      .filter(item => item && (
        (item.name !== undefined && item.value !== undefined) ||
        (Array.isArray(item) && item.length >= 2)
      ))
      .map(item => Array.isArray(item) ? [item[0], item[1]] : [item.name, item.value]);
  }

  if (typeof rawSpecs === 'object') return Object.entries(rawSpecs);

  if (typeof rawSpecs === 'string') {
    return rawSpecs
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const separator = line.indexOf(':');
        return separator === -1
          ? [line, '']
          : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      });
  }

  return [];
}

function renderDetail() {

  const p =
    getProduct();


  if (!p) {

    return renderHome();

  }


  const localizedSpecs =
    getLocalizedSpecs(p);

  // Keep every source characteristic, including manufacturer and country of origin.
  const detailSpecs = localizedSpecs;


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

        <span>
          ›
        </span>

        <span>
          ${esc(p.brand)}
        </span>

        <span>
          ›
        </span>

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
                <div class="product-sku product-sku-detail">

                  <span class="product-sku-label">
                    Артикул
                  </span>

                  <span class="product-sku-value">
                    ${esc(p.sku)}
                  </span>

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


          ${stockMarkup(
            p,
            true
          )}


          <div class="price detail-price ${Number(p.discount_percent || 0) > 0 ? 'price-sale' : ''}">
            ${priceMarkup(p, true)}
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
            detailSpecs.length
              ? `
                <div class="specs">

                  ${
                    detailSpecs
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
                      .join('')
                  }

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


${
  /\.pdf(?:$|[?#])/i.test(p.mounting_scheme)
    ? `
      <a
        href="${esc(p.mounting_scheme)}"
        target="_blank"
        rel="noopener noreferrer"
        class="scheme-pdf"
        style="display:inline-flex;align-items:center;gap:10px;margin-top:8px;padding:12px 16px;background:#176b43;color:#ffffff;border:2px solid #2d9b67;border-radius:10px;font-weight:700;font-size:14px;line-height:1.35;text-decoration:none;box-shadow:0 3px 10px rgba(23,107,67,.18);transition:background .2s ease,transform .2s ease;"
        onmouseover="this.style.background='#0f5232';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.background='#176b43';this.style.transform='translateY(0)'"
        aria-label="Открыть инструкцию по сборке в новой вкладке"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:0 0 22px;">
          <path d="M14.2 6.1a5.1 5.1 0 0 0 6.1 6.1L11 21.5a2.1 2.1 0 0 1-3-3l9.3-9.3a5.1 5.1 0 0 0-6.1-6.1l3.1 3.1-3 3-3.1-3.1a5.1 5.1 0 0 0 6-0.1Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Инструкция по сборке</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:0 0 16px;margin-left:2px;">
          <path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </a>
    `
    : `
      <a
        href="${esc(p.mounting_scheme)}"
        target="_blank"
        rel="noopener"
      >
        <img
          class="scheme"
          src="${esc(p.mounting_scheme)}"
          alt="Схема присадки"
        >
      </a>
    `
}

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
  ).onclick =
    (event) => {

      event.preventDefault();


      history.pushState(
        {},
        '',
        './'
      );


      renderRoute();

    };


  document
    .querySelectorAll(
      '.thumb'
    )
    .forEach(
      (button) => {

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
            .forEach(
              (x) =>
                x.classList.remove(
                  'active'
                )
            );


          button.classList.add(
            'active'
          );

        };

      }
    );


  document.querySelector(
    '#minus'
  ).onclick = () =>
    add(
      p.id,
      -1
    );


  document.querySelector(
    '#plus'
  ).onclick = () =>
    add(
      p.id,
      1
    );


  document.querySelector(
    '#addToCart'
  ).onclick = () =>
    add(
      p.id,
      1
    );


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

    if (
      navigator.share
    ) {

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
        .writeText(
          url
        );


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
    Object.entries(
      cart
    )
      .map(
        ([id, quantity]) => ({

          p:
            state.products.find(
              (product) =>
                String(
                  product.id
                ) ===
                String(
                  id
                )
            ),

          q:
            Number(
              quantity
            )

        })
      )
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

        <span
          class="muted"
        >

          ${items.length}

          ${
            items.length === 1
              ? 'позиция'
              : 'позиций'
          }

          ·

          ${cartQty()}
          шт.

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
              ({ p, q }) => `

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
                            Артикул:
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
    .forEach(
      (button) => {

        button.onclick = () => {

          add(
            decodeURIComponent(
              button.dataset.cartMinus
            ),
            -1
          );


          renderCart();

        };

      }
    );


  drawer
    .querySelectorAll(
      '[data-cart-plus]'
    )
    .forEach(
      (button) => {

        button.onclick = () => {

          add(
            decodeURIComponent(
              button.dataset.cartPlus
            ),
            1
          );


          renderCart();

        };

      }
    );


  const sendButton =
    drawer.querySelector(
      '#sendRequest'
    );


  if (sendButton) {

    sendButton.onclick =
      sendRequest;

  }

}
/* =========================
   EXCEL EXPORT
========================= */

async function loadXlsxLibrary() {

  if (window.XLSX) {

    return window.XLSX;

  }


  await new Promise(
    (resolve, reject) => {

      const existing =
        document.querySelector(
          'script[data-yechim-xlsx="true"]'
        );


      if (existing) {

        existing.addEventListener(
          'load',
          resolve,
          {
            once: true
          }
        );


        existing.addEventListener(
          'error',
          () =>
            reject(
              new Error(
                'Не удалось загрузить Excel-модуль.'
              )
            ),
          {
            once: true
          }
        );


        return;

      }


      const script =
        document.createElement(
          'script'
        );


      script.src =
        'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';


      script.async =
        true;


      script.dataset.yechimXlsx =
        'true';


      script.onload =
        resolve;


      script.onerror =
        () =>
          reject(
            new Error(
              'Не удалось загрузить Excel-модуль. Проверьте подключение к интернету.'
            )
          );


      document.head.appendChild(
        script
      );

    }
  );


  if (!window.XLSX) {

    throw new Error(
      'Excel-модуль загрузился некорректно.'
    );

  }


  return window.XLSX;

}


/* =========================
   SEND REQUEST
========================= */

async function sendRequest() {

  const items =
    Object.entries(
      cart
    )
      .map(
        (
          [id, quantity]
        ) => ({

          p:
            state.products.find(
              (product) =>
                String(
                  product.id
                ) ===
                String(
                  id
                )
            ),

          q:
            Number(
              quantity
            )

        })
      )
      .filter(
        (item) =>
          item.p &&
          item.q > 0
      );


  if (!items.length) {

    return;

  }


  /*
   * Объединяем одинаковые артикулы.
   */

  const rowsBySku =
    new Map();


  items.forEach(
    ({ p, q }) => {

      const sku =
        String(
          p.sku ||
          p.name ||
          p.id
        ).trim();


      rowsBySku.set(
        sku,
        (
          rowsBySku.get(
            sku
          ) ||
          0
        ) + q
      );

    }
  );


  /*
   * Формируем строки Excel.
   */

  const rows =
    Array.from(
      rowsBySku,
      (
        [sku, quantity]
      ) => ({

        'Артикул':
          sku,

        'Количество':
          quantity

      })
    );


  /*
   * Итоговое количество.
   */

  const total =
    rows.reduce(
      (
        sum,
        row
      ) =>
        sum +
        Number(
          row['Количество'] ||
          0
        ),
      0
    );


  /*
   * Добавляем итог.
   */

  rows.push({

    'Артикул':
      'Итого',

    'Количество':
      total

  });


  try {

    const XLSX =
      await loadXlsxLibrary();


    /*
     * Создаём лист.
     */

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );


    /*
     * Ширина колонок.
     */

    worksheet['!cols'] = [

      {
        wch: 24
      },

      {
        wch: 14
      }

    ];


    /*
     * Создаём книгу.
     */

    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Заявка'
    );


    /*
     * Имя файла.
     */

    const now =
      new Date();


    const pad =
      (value) =>
        String(
          value
        ).padStart(
          2,
          '0'
        );


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
     * Скачать Excel.
     */

    XLSX.writeFile(
      workbook,
      filename
    );


    /*
     * После успешного
     * скачивания очищаем корзину.
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


/* =========================
   ADD TO CART
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

const cartButton =
  document.querySelector(
    '#cartButton'
  );


if (cartButton) {

  cartButton.onclick =
    renderCart;

}


/* =========================
   START APP
========================= */

(async () => {

  initLanguageSwitcher();
  await loadProducts();

  renderRoute();
  applyPublicTranslations();

  updateCartBadge();

})();
/* =========================
   LANGUAGE STYLES
========================= */

const languageStyles =
  document.createElement(
    'style'
  );


languageStyles.textContent = `

  /* =========================
     LANGUAGE SWITCHER
  ========================= */

  #languageSwitcher {

    display: flex;

    align-items: center;

    gap: 5px;

    margin-right: 10px;

    white-space: nowrap;

  }


  #languageSwitcher
  .language-btn {

    border: 0;

    background: transparent;

    color: rgba(
      255,
      255,
      255,
      .75
    );

    font: inherit;

    font-size: 12px;

    font-weight: 700;

    cursor: pointer;

    padding: 3px 4px;

  }


  #languageSwitcher
  .language-btn.active {

    color: #fff;

  }


  #languageSwitcher
  .language-divider {

    color: rgba(
      255,
      255,
      255,
      .35
    );

  }


  /* =========================
     PRODUCT SKU
  ========================= */

  .product-sku {

    display: inline-flex;

    align-items: center;

    gap: 5px;

    width: fit-content;

    margin-top: 8px;

    padding: 4px 7px;

    border: 1px solid #b7dfcf;

    border-radius: 5px;

    background: #f5fbf8;

    font-size: 11px;

    line-height: 1.2;

  }


  .product-sku-label {

    color: #078451;

    font-weight: 700;

  }


  .product-sku-value {

    color: #222;

    font-size: 11px;

    font-weight: 600;

  }


  .product-sku-detail {

    margin-top: 9px;

    margin-bottom: 3px;

    padding: 5px 8px;

    font-size: 12px;

  }


  .product-sku-detail
  .product-sku-value {

    font-size: 12px;

  }


  /* =========================
     STOCK STATUS
  ========================= */

  .stock-status {

    display: inline-flex;

    align-items: center;

    gap: 6px;

    width: fit-content;

    margin-top: 8px;

    padding: 4px 7px;

    border-radius: 5px;

    font-size: 11px;

    line-height: 1.2;

    font-weight: 500;

  }


  .stock-status .stock-dot {

    display: inline-flex;

    align-items: center;

    justify-content: center;

    width: 15px;

    height: 15px;

    border-radius: 50%;

    font-size: 10px;

    font-weight: 800;

  }


  .stock-in {

    color: #087c4f;

    background: #f1faf6;

    border: 1px solid #b7dfcf;

  }


  .stock-in .stock-dot {

    color: #fff;

    background: #078451;

  }


  .stock-out {

    color: #a33d3d;

    background: #fff7f7;

    border: 1px solid #e8c4c4;

  }


  .stock-out .stock-dot {

    color: #fff;

    background: #b84a4a;

  }


  .stock-status-detail {

    margin-top: 10px;

    margin-bottom: 3px;

    padding: 5px 8px;

    font-size: 12px;

  }


  .stock-status-detail
  .stock-dot {

    width: 17px;

    height: 17px;

    font-size: 11px;

  }

`;


document.head.appendChild(
  languageStyles
);


/* =========================
   START LANGUAGE SYSTEM
========================= */

initLanguageSwitcher();

applyPublicTranslations();
