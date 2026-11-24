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

const normalize = (value) => String(value ?? '').toLocaleLowerCase('ru-RU').trim();

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

  if (typeof specs === 'object' && !Array.isArray(specs) && specs.manufacturer_specs) {
    specs = { ...specs };
    delete specs.manufacturer_specs;
  }

  if (typeof specs === 'object') {
    return Object.entries(specs)
      .map(([name, value]) => `${name}: ${value ?? ''}`)
      .join('\n');
  }

  return '';
}

function splitCatalogDimensions(rows, language) {
  const uz=language==='uz';
  const names=uz?{l:'Uzunligi',w:'Eni',d:'Chuqurligi',h:'Balandligi',pl:'Qadoq uzunligi',pw:'Qadoq eni',ph:'Qadoq balandligi'}:{l:'Длина',w:'Ширина',d:'Глубина',h:'Высота',pl:'Длина упаковки',pw:'Ширина упаковки',ph:'Высота упаковки'};
  const norm=s=>String(s??'').trim().toLowerCase().replace(/[‘’ʻʼ`]/g,"'").replace(/\s+/g,' ');
  const aliases={ 'длина':'l','длина изделия':'l','uzunligi':'l','uzunlik':'l','ширина':'w','ширина изделия':'w','eni':'w','kengligi':'w','глубина':'d','глубина изделия':'d','chuqurligi':'d','высота':'h','высота изделия':'h','balandligi':'h','длина упаковки':'pl','qadoq uzunligi':'pl','ширина упаковки':'pw','qadoq eni':'pw','высота упаковки':'ph','qadoq balandligi':'ph','ширина модуля':'module','ширина шкафа':'module','modul kengligi':'module','страна производитель':'country','страна производства':'country','ishlab chiqarilgan mamlakat':'country','цвет':'color','rangi':'color'};
  const key=n=>{const s=norm(n).replace(/\s*,\s*(?:мм|mm|см|sm|cm)$/,'');return Object.prototype.hasOwnProperty.call(aliases,s)?aliases[s]:s;};
  const num=String.raw`\d+(?:[.,]\d+)?(?:\s*[-–—/]\s*\d+(?:[.,]\d+)?)*`;
  const unit='(мм|mm|см|sm|cm)';
  const dimension=new RegExp('^'+num+'$');
  const labeled=new RegExp('^(?:длина|uzunligi)\\s*('+num+')\\s*[×xх]\\s*(?:ширина|eni|kengligi)\\s*('+num+')\\s*[×xх]\\s*(?:высота|balandligi)\\s*('+num+')\\s*'+unit+'$','i');
  const full=new RegExp('^(.+?)\\s*'+unit+'$','i');
  const displayUnit=u=>/^(см|sm|cm)$/i.test(u)?(uz?'sm':'см'):(uz?'mm':'мм');
  const canonical=v=>norm(v).replace(/,/g,'.').replace(/[–—]/g,'-').replace(/\s/g,'').replace(/мм$/,'mm').replace(/(?:см|sm)$/,'cm');
  const expanded=rows.flatMap(([name,value])=>{
    const n=norm(name),v=String(value??'').trim();
    if(!/^(?:размеры?|габариты|o'lcham|transport qadoq o'lchamlari)/.test(n))return [[name,value]];
    const m=v.match(labeled);
    if(m)return ['l','w','h'].map((k,i)=>[names[k],m[i+1]+' '+displayUnit(m[4])]);
    const packed=/транспортной упаковки|transport qadoq/.test(n);
    const order=/ш\s*[×xх]\s*г\s*[×xх]\s*в|e\s*[×xх]\s*ch\s*[×xх]\s*b/.test(n)?['w','d','h']:/д\s*[×xх]\s*ш\s*[×xх]\s*в|u\s*[×xх]\s*e\s*[×xх]\s*b/.test(n)?(packed?['pl','pw','ph']:['l','w','h']):null;
    const f=v.match(full);
    if(!order||!f)return [[name,value]];
    const p=f[1].split(/\s*[×xх]\s*/i);
    if(p.length!==3||!p.every(s=>dimension.test(s.trim())))return [[name,value]];
    return order.map((k,i)=>[names[k],p[i].trim()+' '+displayUnit(f[2])]);
  });
  const out=[];
  for(const [name,raw] of expanded){
    let v=raw;
    const m=String(name).match(/,\s*(мм|mm|см|sm|cm)$/i);
    if(m&&dimension.test(String(raw).trim()))v=String(raw).trim()+' '+displayUnit(m[1]);
    if(out.some(([n,x])=>key(n)===key(name)&&canonical(x)===canonical(v)))continue;
    out.push([name,v]);
  }
  return out;
}

function catalogBrandEntry(specs,language){
  const nested=[specs?.[language],specs?.ru,specs?.uz].filter(Array.isArray).flat().find(item=>item?.name==='manufacturer_specs')?.value;
  const manufacturer=specs?.manufacturer_specs||nested;
  if(!manufacturer||typeof manufacturer!=='object'||Array.isArray(manufacturer))return null;
  return Object.entries(manufacturer).find(([,item])=>item&&typeof item==='object'&&('ru' in item||'uz' in item||item.manual_specs))||null;
}

function catalogCharacteristicText(specs,language){
  const entry=catalogBrandEntry(specs,language);
  if(!entry)return '';
  const data=entry[1], manual=data.manual_specs;
  if(manual&&Object.prototype.hasOwnProperty.call(manual,language))return String(manual[language]??'');
  return String(data[language]??data.ru??'');
}

function catalogCharacteristicRows(specs,language){
  const excluded=new Set(['артикул','артикул модели','бренд','artikul','model artikuli','brend']);
  const rows=catalogCharacteristicText(specs,language).split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const i=line.indexOf(':');return i<0?[line,'']:[line.slice(0,i).trim(),line.slice(i+1).trim()];
  }).filter(([name])=>!excluded.has(name.toLowerCase()));
  return splitCatalogDimensions(rows,language);
}

function editableCatalogText(specs,language){return catalogCharacteristicRows(specs,language).map(([name,value])=>`${name}: ${value}`).join('\n');}

function updateCatalogCharacteristics(specs,ru,uz){
  const base=specs&&typeof specs==='object'&&!Array.isArray(specs)?specs:{};
  const entry=catalogBrandEntry(base,'ru');
  const [key,brand]=entry||['manual',{}];
  const manuals={...(brand.manual_specs||{})};
  let changed=false;
  for(const [language,rows] of [['ru',ru],['uz',uz]]){
    const next=rows.map(({name,value})=>`${name}: ${value}`).join('\n');
    if(next!==editableCatalogText(base,language)){manuals[language]=next;changed=true;}
  }
  if(!changed)return base;
  return {...base,manufacturer_specs:{...(base.manufacturer_specs||{}),[key]:{...brand,manual_specs:manuals,manual_specs_updated_at:new Date().toISOString()}}};
}

function downloadCatalogCharacteristics(){
  if(!products.length){alert('Сначала загрузите список товаров.');return;}
  const headers=['Артикул','Бренд','Наименование','Характеристики RU','Характеристики UZ','Описание YECHIM'];
  const quote=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const rows=[headers,...products.map(p=>{const e=enrichment[p.eman_id]||{};return [e.yechim_sku||p.sku||'',e.yechim_brand||p.brand||'',p.name||'',editableCatalogText(e.specs,'ru'),editableCatalogText(e.specs,'uz'),e.description||''];})];
  const csv='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='YECHIM_Characteristics_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function parseSpecs(text, languageLabel) {
  const value = String(text || '').trim();
  if (!value) return [];

  return value.split(/\r?\n/).filter(line=>line.trim()).map((line) => {
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
  $('#exportCharacteristicsBtn').onclick = downloadCatalogCharacteristics;
  $('#dq').oninput = renderTable;
  $('#brandFilter').onchange = renderTable;
  $('#publishedFilter').onchange = renderTable;
  $('#tagProductSearch').oninput = renderTagsManager;
  $('#addBannerBtn').onclick = () => openBannerEditor();
  $('#previewDesktop').onclick = () => setBannerPreviewMode('desktop');
  $('#previewPhone').onclick = () => setBannerPreviewMode('phone');
  ['#bannerTitle','#bannerButton','#bannerImageUrl','#bannerActive'].forEach(sel => $(sel).addEventListener('input', refreshBannerPreview));
  $('#bannerImage').addEventListener('change', readBannerPreviewFile);
  window.addEventListener('resize', fitBannerPreview);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fitBannerPreview).observe($('#bannerPreviewViewport'));
  $('#saveBannerBtn').onclick = saveBanner;
  $('#addBrandBtn').onclick = () => openBrandEditor();
  $('#saveBrandBtn').onclick = saveBrand;
  $('#cancelBrandBtn').onclick = () => $('#brandEditor').hidden = true;
  $('#cancelBannerBtn').onclick = () => { $('#bannerEditor').hidden = true; bannerPreviewFileUrl = ''; $('#bannerImage').value = ''; };
  const pages = { products: '#productsManager', banners: '#bannerManager', brands: '#brandsManager', tags: '#tagsManager', sync: '#syncManager', settings: '#settingsManager' };
  function openDashboardPage(name) {
    Object.entries(pages).forEach(([key, selector]) => { const el = $(selector); if (el) el.hidden = key !== name; });
    document.querySelectorAll('[data-dash-tab]').forEach(b => b.classList.toggle('active', b.dataset.dashTab === name));
    if (name === 'banners') loadBanners();
    if (name === 'brands') loadBrands();
    if (name === 'tags') { populateTagProductSelect(); renderTagsManager(); }
    if (name === 'sync') loadLastSyncTime().then(() => { $('#syncPageLast').textContent = $('#lastSyncInfo').textContent; });
  }
  document.querySelectorAll('[data-dash-tab]').forEach(b => b.onclick = () => openDashboardPage(b.dataset.dashTab));
  $('#menuLogoutBtn').onclick = logout;
  $('#syncPricesBtnPage').onclick = triggerPriceSync;
  openDashboardPage('products');

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
  const button = $('#loginBtn');
  $('#authError').textContent = '';
  const email = $('#email').value.trim();
  const password = $('#password').value;

  if (!email || !password) {
    $('#authError').textContent = 'Введите e-mail и пароль.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Входим…';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    $('#authError').textContent = error.message || 'Не удалось выполнить вход.';
  } finally {
    button.disabled = false;
    button.textContent = 'Войти';
  }
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
    renderTagsManager();
    await loadLastSyncTime();
  } catch (error) {
    $('#syncInfo').textContent = 'Ошибка загрузки';
    $('#authError').textContent = error.message || String(error);
    alert(error.message || String(error));
  }
}

function renderTagsManager() {
  const q = normalize($('#tagProductSearch')?.value || '');
  const list = $('#taggedProductsList');
  if (!list) return;
  const labels = { hit: 'Хит продаж', new: 'Новинка', sale: 'Скидка' };
  const shown = products.filter(p => {
    const e = enrichment[p.eman_id] || {};
    const haystack = [p.name, p.sku, e.yechim_sku, p.brand].map(normalize).join(' ');
    return !q || haystack.includes(q);
  });
  const taggedCount = products.filter(p => (enrichment[p.eman_id]?.product_tags || []).length).length;
  const summary = $('#tagProductsSummary');
  if (summary) summary.textContent = 'Всего товаров: ' + products.length + ' · С метками: ' + taggedCount;
  list.innerHTML = shown.map(p => {
    const e = enrichment[p.eman_id] || {};
    const tags = Array.isArray(e.product_tags) ? e.product_tags : [];
    return '<div class="tag-product-row"><div class="tag-product-info"><b>' + esc(p.name) + '</b><small>Артикул: ' + esc(e.yechim_sku || p.sku || '—') + (p.brand ? ' · ' + esc(p.brand) : '') + '</small></div><div class="tag-quick-actions">' +
      ['hit','new','sale'].map(t => '<button type="button" class="tag-quick-chip tag-'+t+(tags.includes(t)?' is-active':'')+'" data-tag-toggle="'+t+'" data-product-id="'+encodeURIComponent(p.eman_id)+'" '+(e._tagSaving?'disabled':'')+'>'+labels[t]+'</button>').join('') +
      '</div><button class="btn btn-ghost" type="button" data-tag-edit="'+encodeURIComponent(p.eman_id)+'">Карточка</button></div>';
  }).join('') || '<p class="muted">Ничего не найдено.</p>';
  list.querySelectorAll('[data-tag-edit]').forEach(btn => btn.onclick = () => edit(btn.dataset.tagEdit));
  list.querySelectorAll('[data-tag-toggle]').forEach(btn => btn.onclick = () => toggleProductTag(decodeURIComponent(btn.dataset.productId), btn.dataset.tagToggle));
}
async function toggleProductTag(id, tag) {
  const existing = enrichment[id] || { eman_id: id, published: true };
  const currentTags = Array.isArray(existing.product_tags) ? existing.product_tags : [];
  const nextTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
  const row = { eman_id: id, product_tags: nextTags };
  const { error } = await sb.from('yechim_enrichment').upsert(row, { onConflict: 'eman_id' });
  if (error) { alert('Не удалось изменить метку: ' + error.message); return; }
  enrichment[id] = { ...existing, ...row };
  renderTagsManager();
}
function populateTagProductSelect() {
  const select = $('#tagProductSelect'); if (!select) return;
  select.innerHTML = '<option value="">Выберите товар…</option>' + products.map(p => '<option value="'+esc(p.eman_id)+'">'+esc(p.name)+' — '+esc(enrichment[p.eman_id]?.yechim_sku || p.sku || 'без артикула')+'</option>').join('');
}
async function triggerPriceSync() {
  const button = $('#syncPricesBtnPage');
  const info = $('#syncPageStatus');
  if (button.disabled) return;

  button.disabled = true;
  button.textContent = 'Запуск…';
  if (info) info.textContent = 'Запускаем синхронизацию…';
  if ($('#syncPageStatus')) $('#syncPageStatus').textContent = 'Запускаем синхронизацию…';

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
    if (info) info.textContent = 'Обновление отправлено в GitHub Actions';
    if ($('#syncPageStatus')) $('#syncPageStatus').textContent = 'Запрос отправлен в GitHub Actions.';
    alert('Запрос на обновление успешно отправлен. Обновление выполняется в GitHub Actions.');
  } catch (error) {
    if (info) info.textContent = 'Не удалось запустить обновление';
    if ($('#syncPageStatus')) $('#syncPageStatus').textContent = error.message || String(error);
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

  const specsRu = editableCatalogText(e.specs,'ru');
  const specsUz = editableCatalogText(e.specs,'uz');

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
      <label>Описание YECHIM</label>
      <textarea id="description" placeholder="Добавь дополнительную информацию, если необходимо">${esc(e.description || '')}</textarea>
      <div class="muted small">Собственное описание товара YECHIM (при необходимости).</div>
    </div>

    <div class="field">
      <label>Характеристики на русском языке</label>
      <textarea id="specs_ru" rows="10" placeholder="Цвет: Черный&#10;Материал: Сталь&#10;Длина (мм): 500">${esc(specsToText(specsRu))}</textarea>
      <div class="muted small">Текущие характеристики производителя. Можно изменять, добавлять и удалять строки. Формат: «Название: значение».</div>
    </div>

    <div class="field">
      <label>Характеристики на узбекском языке</label>
      <textarea id="specs_uz" rows="10" placeholder="Artikul: S-6835-A&#10;Eni (mm): 700&#10;Chuqurligi (mm): 360&#10;Balandligi (mm): 1910–2110">${esc(specsToText(specsUz))}</textarea>
      <div class="muted small">Текущие характеристики на узбекском. Изменения сохраняются отдельно от русского языка.</div>
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

    <div class="field"><label>Метки товара</label><input id="product_tags" value="${esc((e.product_tags || []).join(", "))}" placeholder="hit, new, sale"><div class="muted small">Допустимые метки: hit, new, sale</div></div>
    <div class="grid2">
      <div class="field">
        <label>Скидка, %</label>
        <input id="discount_percent" type="number" min="0" max="99" step="1" value="${Math.min(99, Math.max(0, Number(e.discount_percent || 0)))}" placeholder="0">
        <div class="muted small">Укажи процент скидки от цены Eman. 0 — без скидки.</div>
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
      specs: updateCatalogCharacteristics(currentE.specs, specsRu, specsUz),

      mounting_scheme_url: scheme,
      additional_images: images,
      product_tags: $('#product_tags').value.split(',').map(x => x.trim()).filter(x => ['hit','new','sale'].includes(x)),
      is_featured: ($('#product_tags').value.split(',').map(x => x.trim()).filter(x => ['hit','new','sale'].includes(x)).length > 0),
      discount_percent: Math.min(99, Math.max(0, Number($('#discount_percent').value || 0)))
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


function openBrandEditor(brand = null) {
  $('#brandEditor').hidden = false;
  $('#brandEditorTitle').textContent = brand ? 'Редактировать бренд' : 'Новый бренд';
  $('#brandId').value = brand?.id || '';
  $('#brandName').value = brand?.name || '';
  $('#brandImageUrl').value = brand?.image_url || '';
  $('#brandImage').value = '';
  $('#brandActive').checked = brand?.active !== false;
  $('#brandOrder').value = brand?.sort_order ?? 0;
  $('#brandError').textContent = '';
}
async function loadBrands() {
  const { data, error } = await sb.from('yechim_brands').select('*').order('sort_order').order('name');
  if (error) { $('#brandList').textContent = 'Ошибка загрузки брендов: ' + error.message + '. Проверьте выполнение supabase-migration-brands.sql.'; return; }
  window.yechimBrands = data || [];
  $('#brandList').innerHTML = window.yechimBrands.map(b => '<div class="brand-admin-row">'+(b.image_url?'<img src="'+esc(b.image_url)+'" alt="">':'<span class="muted">Нет изображения</span>')+'<b>'+esc(b.name)+'</b><span>'+(b.active?'Активен':'Скрыт')+'</span><button class="btn btn-ghost" data-edit-brand="'+b.id+'" type="button">Изменить</button><button class="btn btn-ghost" data-delete-brand="'+b.id+'" type="button" title="Удалить">🗑</button></div>').join('') || '<p class="muted">Брендов пока нет. Добавьте первый бренд.</p>';
  $('#brandList').querySelectorAll('[data-edit-brand]').forEach(btn => btn.onclick = () => openBrandEditor(window.yechimBrands.find(b => b.id === btn.dataset.editBrand)));
  $('#brandList').querySelectorAll('[data-delete-brand]').forEach(btn => btn.onclick = async () => { if (!confirm('Удалить бренд?')) return; const { error } = await sb.from('yechim_brands').delete().eq('id', btn.dataset.deleteBrand); if (error) alert(error.message); else loadBrands(); });
}
async function saveBrand() {
  $('#brandError').textContent = '';
  try {
    const name = $('#brandName').value.trim();
    if (!name) throw new Error('Укажите название бренда.');
    let image = $('#brandImageUrl').value.trim();
    const file = $('#brandImage').files[0];
    if (file) image = await uploadFile(file, 'brands');
    if (!image) throw new Error('Загрузите изображение бренда или укажите URL.');
    const row = { name, image_url: image, active: $('#brandActive').checked, sort_order: Number($('#brandOrder').value || 0) };
    const id = $('#brandId').value;
    const result = id ? await sb.from('yechim_brands').update(row).eq('id', id) : await sb.from('yechim_brands').insert(row);
    if (result.error) throw result.error;
    $('#brandEditor').hidden = true;
    await loadBrands();
  } catch (e) { $('#brandError').textContent = e.message || String(e); }
}


let bannerPreviewMode = 'desktop';
let bannerPreviewFileUrl = '';
let bannerPreviewReadToken = 0;

function openBannerEditor(b = null) {
  ++bannerPreviewReadToken;
  bannerPreviewFileUrl = '';
  $('#bannerEditor').hidden = false;
  $('#bannerId').value = b?.id || '';
  $('#bannerTitle').value = b?.title || '';
  $('#bannerSubtitle').value = b?.subtitle || '';
  $('#bannerButton').value = b?.button_text || '';
  $('#bannerLink').value = b?.link_url || '?catalog=1';
  $('#bannerImageUrl').value = b?.image_url || '';
  $('#bannerImage').value = '';
  $('#bannerActive').checked = b?.active === true;
  $('#bannerOrder').value = b?.sort_order || 0;
  $('#bannerError').textContent = '';
  $('#bannerEditorHeading').textContent = b ? 'Редактирование баннера' : 'Новый баннер';
  setBannerPreviewMode(bannerPreviewMode);
}

function readBannerPreviewFile() {
  const token = ++bannerPreviewReadToken;
  const file = $('#bannerImage').files[0];
  bannerPreviewFileUrl = '';
  if (!file) { refreshBannerPreview(); return; }
  const reader = new FileReader();
  reader.onload = () => {
    if (token !== bannerPreviewReadToken) return;
    bannerPreviewFileUrl = String(reader.result || '');
    refreshBannerPreview();
  };
  reader.onerror = () => { if (token === bannerPreviewReadToken) $('#bannerError').textContent = 'Не удалось прочитать изображение.'; };
  reader.readAsDataURL(file);
}

function setBannerPreviewMode(mode) {
  bannerPreviewMode = mode === 'phone' ? 'phone' : 'desktop';
  $('#previewDesktop').setAttribute('aria-pressed', String(bannerPreviewMode === 'desktop'));
  $('#previewPhone').setAttribute('aria-pressed', String(bannerPreviewMode === 'phone'));
  refreshBannerPreview();
}

function fitBannerPreview() {
  const viewport = $('#bannerPreviewViewport');
  const frame = $('#bannerPreviewFrame');
  if (!viewport || !frame || viewport.clientWidth < 1 || $('#bannerEditor').hidden) return;
  const width = bannerPreviewMode === 'phone' ? 390 : 1440;
  const height = bannerPreviewMode === 'phone' ? 200 : 430;
  const scale = Math.min(1, viewport.clientWidth / width);
  frame.style.width = width + 'px';
  frame.style.height = height + 'px';
  frame.style.transform = 'scale(' + scale + ')';
  $('#bannerPreviewStage').style.width = width * scale + 'px';
  $('#bannerPreviewStage').style.height = height * scale + 'px';
}

function bannerPreviewMarkup(image, title, button, count, cssUrl) {
  const dots = count > 1 ? Array.from({length:count}, (_,i) => '<button class="banner-carousel-dot'+(i===0?' is-active':'')+'" type="button" tabindex="-1"></button>').join('') : '';
  const control = dots ? '<div class="banner-carousel-controls"><button class="banner-carousel-arrow" type="button" tabindex="-1">‹</button><div class="banner-carousel-dots">'+dots+'</div><button class="banner-carousel-arrow" type="button" tabindex="-1">›</button></div>' : '';
  const style = 'background-image:url(' + JSON.stringify(image) + ')';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+esc(cssUrl)+'"><style>html,body{margin:0;overflow:hidden}body{pointer-events:none}.home-shell{margin-bottom:0!important;padding-bottom:0!important}.home-banner-carousel{margin-bottom:0!important}</style></head><body><div class="shell home-shell"><div class="home-banner-carousel"><section class="hero-banner" style="'+esc(style)+'"><img class="hero-banner-mobile-image" src="'+esc(image)+'" alt="'+esc(title)+'">'+(button?'<a class="hero-cta">'+esc(button)+' <span aria-hidden="true">→</span></a>':'')+'</section>'+control+'</div></div></body></html>';
}

function refreshBannerPreview() {
  const frame = $('#bannerPreviewFrame'), empty = $('#bannerPreviewEmpty'), viewport = $('#bannerPreviewViewport');
  const raw = bannerPreviewFileUrl || $('#bannerImageUrl').value.trim();
  $('#bannerPreviewStatus').textContent = $('#bannerActive').checked ? 'Включён — будет показан после сохранения' : 'Выключен — скрыт с сайта';
  $('#bannerPreviewSize').textContent = bannerPreviewMode === 'phone' ? 'Телефон · 390 px' : 'ПК · 1440 px';
  let image = '';
  try {
    if (raw) {
      const parsed = new URL(raw, new URL('../', location.href));
      if (['https:','http:'].includes(parsed.protocol) || (parsed.protocol === 'data:' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(raw))) image = parsed.href;
    }
  } catch (_) {}
  if (!image) {
    viewport.hidden = true; empty.hidden = false;
    frame.removeAttribute('srcdoc');
    return;
  }
  viewport.hidden = false; empty.hidden = true;
  const id = $('#bannerId').value;
  const activeOthers = (window.yechimBanners || []).filter(b => b.active === true && String(b.id) !== id && b.image_url).length;
  const cssUrl = new URL('../styles.css?v=20261124-banner-preview-1', location.href).href;
  frame.srcdoc = bannerPreviewMarkup(image,$('#bannerTitle').value,$('#bannerButton').value,activeOthers+1,cssUrl);
  fitBannerPreview();
}

async function saveBanner() {
  $('#bannerError').textContent = '';
  const save = $('#saveBannerBtn');
  save.disabled = true;
  try {
    let image = $('#bannerImageUrl').value.trim();
    const file = $('#bannerImage').files[0];
    if (file) image = await uploadFile(file, 'banners');
    if (!image) throw new Error('Добавь изображение баннера.');
    const row = { title: $('#bannerTitle').value.trim(), subtitle: $('#bannerSubtitle').value.trim(), button_text: $('#bannerButton').value.trim(), link_url: $('#bannerLink').value.trim() || '?catalog=1', image_url: image, active: $('#bannerActive').checked === true, sort_order: Number($('#bannerOrder').value || 0) };
    const id = $('#bannerId').value;
    const result = id ? await sb.from('yechim_banners').update(row).eq('id', id).select('id').single() : await sb.from('yechim_banners').insert(row).select('id').single();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Сохранение не подтверждено.');
    $('#bannerEditor').hidden = true;
    ++bannerPreviewReadToken;
    bannerPreviewFileUrl = '';
    $('#bannerImage').value = '';
    await loadBanners();
  } catch (e) { $('#bannerError').textContent = e.message || String(e); }
  finally { save.disabled = false; }
}

async function loadBanners() {
  const { data, error } = await sb.from('yechim_banners').select('*').order('sort_order');
  if (error) { $('#bannerList').textContent = 'Ошибка загрузки баннеров: ' + error.message; return; }
  window.yechimBanners = data || [];
  $('#bannerList').innerHTML = window.yechimBanners.map(b => {
    const active = b.active === true;
    return '<div class="banner-admin-row"><img class="banner-admin-thumb" src="'+esc(b.image_url)+'" alt=""><div class="banner-admin-info"><b>'+esc(b.title || 'Без названия')+'</b><small>'+esc(b.link_url || '')+'</small></div><button type="button" class="banner-toggle'+(active?' is-on':'')+'" role="switch" aria-checked="'+active+'" aria-label="Показывать баннер '+esc(b.title)+'" data-toggle-banner="'+esc(b.id)+'"><i></i>'+ (active?'Включён':'Выключен')+'</button><div class="banner-admin-actions"><button class="btn btn-ghost" type="button" data-edit-banner="'+esc(b.id)+'">Предпросмотр / изменить</button><button class="btn btn-ghost" type="button" title="Удалить" aria-label="Удалить баннер" data-delete-banner="'+esc(b.id)+'">×</button></div></div>';
  }).join('') || 'Баннеров пока нет.';
  $('#bannerList').querySelectorAll('[data-edit-banner]').forEach(btn => btn.onclick = () => {
    const b = window.yechimBanners.find(x => String(x.id) === btn.dataset.editBanner);
    if (b) { openBannerEditor(b); $('#bannerEditor').scrollIntoView({block:'nearest'}); }
  });
  $('#bannerList').querySelectorAll('[data-toggle-banner]').forEach(btn => btn.onclick = async () => {
    const b = window.yechimBanners.find(x => String(x.id) === btn.dataset.toggleBanner);
    if (!b) return;
    btn.disabled = true;
    try {
      const next = b.active !== true;
      const result = await sb.from('yechim_banners').update({active:next}).eq('id',b.id).select('id,active').single();
      if (result.error) throw result.error;
      if (result.data?.active !== next) throw new Error('Изменение статуса не подтверждено.');
      if ($('#bannerId').value === String(b.id)) $('#bannerActive').checked = next;
      await loadBanners();
      if (!$('#bannerEditor').hidden) refreshBannerPreview();
    } catch(e) { alert('Не удалось изменить статус: '+(e.message||String(e))); }
    finally { btn.disabled = false; }
  });
  $('#bannerList').querySelectorAll('[data-delete-banner]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Удалить баннер?')) return;
    const res = await sb.from('yechim_banners').delete().eq('id', btn.dataset.deleteBanner);
    if (res.error) alert(res.error.message);
    else { if ($('#bannerId').value === btn.dataset.deleteBanner) $('#bannerEditor').hidden = true; await loadBanners(); }
  });
}

/* =========================
   START DASHBOARD
========================= */

init();
