const CONFIG = window.YECHIM_CONFIG || {};

const READY = Boolean(
  window.supabase &&
  CONFIG.supabaseUrl &&
  !CONFIG.supabaseUrl.includes('YOUR_PROJECT') &&
  CONFIG.supabaseAnonKey &&
  !CONFIG.supabaseAnonKey.includes('YOUR_')
);

const sb = READY
  ? window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    )
  : null;

let products = [];
let enrichment = {};
let current = null;

const $ = (s) => document.querySelector(s);

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[c])
  );

const money = (v) =>
  Number(v || 0).toLocaleString('ru-RU') + ' сум';

/* =========================
   CHARACTERISTICS HELPERS
========================= */

function specsToText(specs) {
  if (!specs) return '';

  if (Array.isArray(specs)) {
    return specs
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        return `${item.name ?? ''}: ${item.value ?? ''}`;
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof specs === 'string') return specs;

  if (typeof specs === 'object') {
    return Object.entries(specs)
      .map(([name, value]) => `${name}: ${value ?? ''}`)
      .join('\n');
  }

  return '';
}

function parseSpecs(text, languageLabel) {
  const value = String(text || '').trim();
  if (!value) return [];

  return value.split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':');

    if (separator === -1) {
      throw new Error(
        `Характеристики (${languageLabel}): каждая строка должна быть в формате «Название: значение».`
      );
    }

    const name = line.slice(0, separator).trim();
    const itemValue = line.slice(separator + 1).trim();

    if (!name || !itemValue) {
      throw new Error(
        `Характеристики (${languageLabel}): у каждой строки должны быть название и значение.`
      );
    }

    return { name, value: itemValue };
  });
}

/* =========================
   INIT
========================= */

async function init() {
  $('#loginBtn').onclick = login;
  $('#logoutBtn').onclick = logout;
  $('#closeModal').onclick = closeModal;
  $('#saveBtn').onclick = saveEdit;
  $('#syncPricesBtn').onclick = triggerPriceSync;
  $('#dq').oninput = renderTable;
  $('#brandFilter').onchange = renderTable;
  $('#publishedFilter').onchange = renderTable;
  $('#addBannerBtn').onclick = () => { $('#bannerEditor').hidden = false; $('#bannerId').value = ''; $('#bannerTitle').value = ''; $('#bannerSubtitle').value = ''; $('#bannerButton').value = ''; $('#bannerLink').value = '?catalog=1'; $('#bannerImageUrl').value = ''; $('#bannerActive').checked = true; $('#bannerOrder').value = 0; };
  $('#saveBannerBtn').onclick = saveBanner;
  $('#cancelBannerBtn').onclick = () => $('#bannerEditor').hidden = true;
  document.querySelectorAll('[data-dash-tab]').forEach(b => b.onclick = () => { $('#bannerManager').hidden = b.dataset.dashTab !== 'banners'; });

  if (!READY) {
    $('#authError').textContent =
      'Заполни supabase-config.js перед подключением Dashboard.';
    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();

  if (session) {
    await showApp(session);
  } else {
    showLogin();
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      await showApp(session);
    } else {
      showLogin();
    }
  });
}

/* =========================
   AUTH
========================= */

function showLogin() {
  $('#authPanel').hidden = false;
  $('#appPanel').hidden = true;
  $('#logoutBtn').hidden = true;
}

async function showApp(session) {
  $('#authPanel').hidden = true;
  $('#appPanel').hidden = false;
  $('#logoutBtn').hidden = false;
  $('#userLabel').textContent = session.user.email || '';
  await loadData();
}

async function login() {
  $('#authError').textContent = '';
  const email = $('#email').value.trim();
  const password = $('#password').value;

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) $('#authError').textContent = error.message;
}

async function logout() {
  await sb.auth.signOut();
}

/* =========================
   FETCH ALL
========================= */

async function fetchAll(table, orderColumn = null) {
  const chunk = 1000;
  let from = 0;
  const all = [];

  while (true) {
    let query = sb
      .from(table)
      .select('*')
      .range(from, from + chunk - 1);

    if (orderColumn) query = query.order(orderColumn);

    const { data, error } = await query;
    if (error) throw error;

    all.push(...(data || []));
    if (!data || data.length < chunk) break;
    from += chunk;
  }

  return all;
}

/* =========================
   LOAD DATA
========================= */

async function loadLastSyncTime() {
  const el = $('#lastSyncInfo');
  if (!el) return;

  try {
    const response = await fetch('../data/last_sync.json', {
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('Дата обновления пока недоступна');

    const data = await response.json();
    el.textContent = data.last_successful_sync
      ? `Последнее обновление: ${new Date(
          data.last_successful_sync
        ).toLocaleString('ru-RU', {
          timeZone: 'Asia/Tashkent',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })}`
      : 'Последнее обновление: нет данных';
  } catch {
    el.textContent = 'Последнее обновление: нет данных';
  }
}

async function loadData() {
  $('#syncInfo').textContent = 'Загрузка…';

  try {
    const [p, e] = await Promise.all([
      fetchAll('eman_products', 'name'),
      fetchAll('yechim_enrichment')
    ]);

    products = p || [];
    enrichment = Object.fromEntries(
      (e || []).map((item) => [item.eman_id, item])
    );

    fillBrands();
    renderTable();
    $('#syncInfo').textContent = `Товаров: ${products.length}`;
    await loadLastSyncTime();
  } catch (error) {
    $('#syncInfo').textContent = 'Ошибка загрузки';
    $('#authError').textContent = error.message || String(error);
    alert(error.message || String(error));
  }
}

async function triggerPriceSync() {
  const button = $('#syncPricesBtn');
  const info = $('#syncInfo');
  if (button.disabled) return;

  button.disabled = true;
  button.textContent = 'Запуск…';
  info.textContent = 'Запускаем синхронизацию…';

  try {
    const { data, error } = await sb.functions.invoke(
      'trigger-price-sync',
      { body: {} }
    );

    if (error) {
      let detail = error.message || String(error);
      if (error.context && typeof error.context.json === 'function') {
        try {
          const body = await error.context.json();
          detail = body.details || body.error || detail;
        } catch (_) {}
      }
      throw new Error(detail);
    }
    info.textContent = 'Обновление отправлено в GitHub Actions';
    alert('Запрос на обновление успешно отправлен. Обновление выполняется в GitHub Actions.');
  } catch (error) {
    info.textContent = 'Не удалось запустить обновление';
    alert('Не удалось запустить обновление: ' + (error.message || String(error))); 
  } finally {
    button.disabled = false;
    button.textContent = 'Обновить цены сейчас';
  }
}

/* =========================
   BRANDS
========================= */

function fillBrands() {
  const brands = [
    ...new Set(products.map((p) => p.brand).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b));

  $('#brandFilter').innerHTML =
    '<option value="all">Все бренды</option>' +
    brands
      .map((b) => `<option value="${esc(b)}">${esc(b)}</option>`)
      .join('');
}

/* =========================
   TABLE
========================= */

function renderTable() {
  const q = $('#dq').value.toLowerCase().trim();
  const brand = $('#brandFilter').value;
  const publication = $('#publishedFilter')?.value || 'all';

  const list = products.filter((p) => {
    const e = enrichment[p.eman_id] || {};
    // Search both the original Eman SKU and the optional YECHIM SKU.
    // The table displays p.sku when no custom YECHIM SKU is set, so it
    // must also be included in the admin search index.
    const haystack = [p.name, p.brand, p.sku, e.yechim_sku]
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter(Boolean)
      .join(' ');

    const matchesSearch = !q || haystack.includes(q);
    const matchesBrand = brand === 'all' || p.brand === brand;
    const isPublished = (enrichment[p.eman_id]?.published ?? true) !== false;
    const matchesPublication = publication === 'all' || (publication === 'published' ? isPublished : !isPublished);
    return matchesSearch && matchesBrand && matchesPublication;
  });

  $('#tbody').innerHTML = list.map((p) => {
    const e = enrichment[p.eman_id] || {};
    return `
      <tr>
        <td>
          <div class="product-cell">
            ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" loading="lazy">` : ''}
            <div><b>${esc(p.name)}</b><div class="muted">${esc(p.brand)}</div></div>
          </div>
        </td>
        <td>${esc(e.yechim_sku || p.sku || '—')}</td>
        <td>${p.price ? money(p.price) : '—'}</td>
        <td><button class="btn ${((e.published ?? true) ? 'btn-primary' : 'btn-ghost')}" onclick="togglePublished('${encodeURIComponent(p.eman_id)}')">${((e.published ?? true) ? 'Опубликован' : 'Скрыт')}</button></td>
        <td><button class="btn btn-ghost" onclick="edit('${encodeURIComponent(p.eman_id)}')">Редактировать</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="muted">Ничего не найдено.</td></tr>';

}


async function togglePublished(encodedId) {
  const id = decodeURIComponent(encodedId);
  const p = products.find((item) => item.eman_id === id);
  if (!p) return;
  const currentRow = enrichment[id] || { eman_id: id };
  const nextPublished = (currentRow.published ?? true) === false;
  const { error } = await sb.from('yechim_enrichment').upsert(
    { ...currentRow, eman_id: id, published: nextPublished },
    { onConflict: 'eman_id' }
  );
  if (error) { alert('Не удалось изменить публикацию: ' + error.message); return; }
  enrichment[id] = { ...currentRow, eman_id: id, published: nextPublished };
  renderTable();
}
window.togglePublished = togglePublished;

/* =========================
   EDIT PRODUCT
========================= */

function edit(encodedId) {
  const id = decodeURIComponent(encodedId);
  current = id;

  const p = products.find((x) => x.eman_id === id);
  if (!p) return;

  const e = enrichment[id] || {
    eman_id: id,
    published: true,
    yechim_sku: '',
    yechim_brand: p?.brand || '',
    description: '',
    specs: {},
    mounting_scheme_url: '',
    additional_images: [],
    badge: '',
    discount_percent: 0,
    sort_order: 0
  };

  // Поддержка старых товаров: прежние характеристики считаются русскими.
  const savedSpecs = e.specs || {};
  const specsRu = savedSpecs && typeof savedSpecs === 'object' && !Array.isArray(savedSpecs) && ('ru' in savedSpecs || 'uz' in savedSpecs)
    ? savedSpecs.ru
    : savedSpecs;
  const specsUz = savedSpecs && typeof savedSpecs === 'object' && !Array.isArray(savedSpecs)
    ? savedSpecs.uz
    : [];
  const emanExtra = p.extra && typeof p.extra === 'object' ? p.extra : {};
  const emanDescription = emanExtra.eman_description || '';
  const emanSpecs = Array.isArray(emanExtra.eman_specs) ? emanExtra.eman_specs : [];

  $('#mbrand').textContent = p?.brand || '';
  $('#mtitle').textContent = p?.name || id;

  $('#fields').innerHTML = `
    <div class="grid2">
      <div class="field">
        <label>Артикул YECHIM</label>
        <input id="yechim_sku" value="${esc(e.yechim_sku || '')}" placeholder="Введите артикул">
      </div>
      <div class="field">
        <label>Показывать в каталоге</label>
        <label class="switch">
          <input id="published" type="checkbox" ${e.published !== false ? 'checked' : ''}>
          <span></span>
        </label>
      </div>
    </div>

    <div class="field">
      <label>Бренд YECHIM</label>
      <input id="yechim_brand" value="${esc(e.yechim_brand || p.brand || '')}" placeholder="${esc(p.brand || '')}">
    </div>

    <div class="field">
      <label>Описание с Eman.uz</label>
      <div class="source-content">${emanDescription ? esc(emanDescription) : '<span class="muted">На странице Eman описание не найдено.</span>'}</div>
    </div>

    <div class="field">
      <label>Дополнение к описанию YECHIM</label>
      <textarea id="description" placeholder="Добавь дополнительную информацию, если необходимо">${esc(e.description || '')}</textarea>
      <div class="muted small">Это дополнение будет показано после описания, полученного с Eman.uz.</div>
    </div>

    <div class="field">
      <label>Характеристики с Eman.uz</label>
      <div class="source-content source-specs">${emanSpecs.length ? esc(specsToText(emanSpecs)) : '<span class="muted">На странице Eman характеристики не найдены. Их можно добавить ниже.</span>'}</div>
    </div>

    <div class="field">
      <label>Дополнительные характеристики на русском языке</label>
      <textarea id="specs_ru" placeholder="Цвет: Черный&#10;Материал: Сталь&#10;Длина (мм): 500">${esc(specsToText(specsRu))}</textarea>
      <div class="muted small">Добавляй только недостающие характеристики — по одной на строку в формате «Название: значение». Они будут добавлены к характеристикам с Eman.uz.</div>
    </div>

    <div class="field">
      <label>Характеристики на узбекском языке</label>
      <textarea id="specs_uz" placeholder="Artikul: S-6835-A&#10;Eni (mm): 700&#10;Chuqurligi (mm): 360&#10;Balandligi (mm): 1910–2110">${esc(specsToText(specsUz))}</textarea>
      <div class="muted small">Вводи собственный узбекский перевод. Автоматического перевода нет. Если поле оставить пустым, характеристики на узбекском не показываются.</div>
    </div>

    <div class="field">
      <label>Схема присадки</label>
      <div class="upload-row">
        <input id="mounting_scheme_url" value="${esc(e.mounting_scheme_url || '')}" placeholder="URL или загрузить изображение">
        <input id="schemeFile" type="file" accept="image/*,.pdf,application/pdf">
      </div>
    </div>

    <div class="field">
      <label>Дополнительные фотографии</label>
      <input id="imagesFiles" type="file" accept="image/*" multiple>
      <div id="existingImages" class="image-list">
        ${(e.additional_images || []).map((u) => `
          <div>
            <img src="${esc(u)}">
            <button class="btn btn-ghost" onclick="removeExistingImage('${encodeURIComponent(u)}')">×</button>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="field"><label><input id="is_featured" type="checkbox" ${e.is_featured ? "checked" : ""}> Показывать в блоке «Специально для вас»</label></div>
    <div class="field"><label>Метки товара</label><input id="product_tags" value="${esc((e.product_tags || []).join(", "))}" placeholder="hit, new, sale"><div class="muted small">Допустимые метки: hit, new, sale</div></div>
    <div class="grid2">
      <div class="field">
        <label>Скидка, %</label>
        <input id="discount_percent" type="number" min="0" max="99" step="1" value="${Math.min(99, Math.max(0, Number(e.discount_percent || 0)))}" placeholder="0">
        <div class="muted small">Укажи процент скидки от цены Eman. 0 — без скидки.</div>
      </div>
      <div class="field">
        <label>Бейдж</label>
        <input id="badge" value="${esc(e.badge || '')}" placeholder="Новинка">
      </div>
      <div class="field">
        <label>Порядок отображения</label>
        <input id="sort_order" type="number" value="${Number(e.sort_order || 0)}">
      </div>
    </div>
  `;

  $('#saveError').textContent = '';
  $('#modal').classList.add('open');
}

/* =========================
   FILE UPLOAD
========================= */

async function uploadFile(file, folder) {
  if (!file) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await sb.storage
    .from('yechim-assets')
    .upload(path, file, { upsert: false });

  if (error) throw error;

  return `${CONFIG.supabaseUrl}/storage/v1/object/public/yechim-assets/${path}`;
}

/* =========================
   SAVE PRODUCT
========================= */

async function saveEdit() {
  $('#saveError').textContent = '';

  try {
    const p = products.find((x) => x.eman_id === current);
    if (!p) throw new Error('Товар не найден.');

    const currentE = enrichment[current] || {};

    const discount = Number($('#discount_percent').value || 0);
    if (!Number.isInteger(discount) || discount < 0 || discount > 99) {
      throw new Error('Скидка должна быть целым числом от 0 до 99.');
    }

    const specsRu = parseSpecs($('#specs_ru').value, 'RU');
    const specsUz = parseSpecs($('#specs_uz').value, 'UZ');

    let scheme = $('#mounting_scheme_url').value.trim();
    const schemeFile = $('#schemeFile').files[0];

    if (schemeFile) {
      scheme = await uploadFile(schemeFile, `schemes/${current}`);
    }

    let images = [...(currentE.additional_images || [])];
    const files = [...$('#imagesFiles').files];

    for (const file of files) {
      const url = await uploadFile(file, `images/${current}`);
      if (url) images.push(url);
    }

    const row = {
      eman_id: current,
      published: $('#published').checked,
      yechim_sku: $('#yechim_sku').value.trim(),
      yechim_brand: $('#yechim_brand').value.trim() || p.brand,
      description: $('#description').value.trim(),

      // Храним оба языка в существующем JSON-поле specs.
      // Это не требует добавления новых колонок в Supabase.
      specs: {
        ru: specsRu,
        uz: specsUz
      },

      mounting_scheme_url: scheme,
      additional_images: images,
      badge: $('#badge').value.trim(),
      product_tags: $('#product_tags').value.split(',').map(x => x.trim()).filter(x => ['hit','new','sale'].includes(x)),
      is_featured: $('#is_featured').checked,
      discount_percent: Math.min(99, Math.max(0, Number($('#discount_percent').value || 0))),
      sort_order: Number($('#sort_order').value || 0)
    };

    const { error } = await sb
      .from('yechim_enrichment')
      .upsert(row, { onConflict: 'eman_id' });

    if (error) throw error;

    closeModal();
    await loadData();
  } catch (error) {
    $('#saveError').textContent = error.message || String(error);
  }
}

/* =========================
   REMOVE EXISTING IMAGE
========================= */

function removeExistingImage(encoded) {
  const url = decodeURIComponent(encoded);
  const e = enrichment[current] || {};

  e.additional_images = (e.additional_images || []).filter((x) => x !== url);
  enrichment[current] = e;
  edit(encodeURIComponent(current));
}

/* =========================
   CLOSE MODAL
========================= */

function closeModal() {
  $('#modal').classList.remove('open');
  current = null;
}

/* =========================
   GLOBAL FUNCTIONS
========================= */

window.edit = edit;
window.removeExistingImage = removeExistingImage;
window.closeModal = closeModal;


async function saveBanner() {
  $('#bannerError').textContent = '';
  try {
    let image = $('#bannerImageUrl').value.trim();
    const file = $('#bannerImage').files[0];
    if (file) image = await uploadFile(file, 'banners');
    if (!image) throw new Error('Добавь изображение баннера.');
    const row = { title: $('#bannerTitle').value.trim(), subtitle: $('#bannerSubtitle').value.trim(), button_text: $('#bannerButton').value.trim(), link_url: $('#bannerLink').value.trim() || '?catalog=1', image_url: image, active: $('#bannerActive').checked, sort_order: Number($('#bannerOrder').value || 0) };
    const id = $('#bannerId').value;
    const result = id ? await sb.from('yechim_banners').update(row).eq('id', id) : await sb.from('yechim_banners').insert(row);
    if (result.error) throw result.error;
    $('#bannerEditor').hidden = true;
    await loadBanners();
  } catch (e) { $('#bannerError').textContent = e.message || String(e); }
}
async function loadBanners() {
  const { data, error } = await sb.from('yechim_banners').select('*').order('sort_order');
  if (error) { $('#bannerList').textContent = 'Ошибка загрузки баннеров: ' + error.message; return; }
  window.yechimBanners = data || [];
  $('#bannerList').innerHTML = window.yechimBanners.map(b => '<div class="banner-row"><img src="'+esc(b.image_url)+'"><b>'+esc(b.title)+'</b><span>'+(b.active?'Активен':'Скрыт')+'</span></div>').join('') || 'Баннеров пока нет.';
}

/* =========================
   START DASHBOARD
========================= */

init();
