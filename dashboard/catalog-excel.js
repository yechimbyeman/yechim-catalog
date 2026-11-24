// YECHIM catalog XLSX import and export. Only enrichment fields are writable.
(function excelModule(){
  'use strict';
  const H={sku:'Артикул',brand:'Бренд',name:'Наименование',link:'Ссылка на YECHIM E-Catalog',desc:'Описание YECHIM'};
  const fixed=Object.values(H);
  const text=v=>String(v??'').trim();
  const getLink=id=>new URL('../?product='+encodeURIComponent(id),location.href).href;
  const specHeader=(name,lang,n=1)=>name+(n>1?' ['+n+']':'')+' · '+lang.toUpperCase();
  function specMap(specs,lang){
    const m=new Map(),counts=new Map();
    for(const [name,value] of catalogCharacteristicRows(specs,lang)){
      const n=(counts.get(name)||0)+1;counts.set(name,n);
      m.set(specHeader(name,lang,n),{name,value:String(value??'')});
    }
    return m;
  }
  function parseHeader(h){
    const m=h.match(/^(.+?)\s*·\s*(RU|UZ)$/i);
    if(!m)return null;
    const name=m[1].trim().replace(/\s+\[\d+\]$/,'');
    if(!name||/[:\r\n]/.test(name))throw new Error('Недопустимое название характеристики: '+h);
    return {name,lang:m[2].toLowerCase()};
  }
  function rowsFor(p,e){
    const ru=specMap(e.specs,'ru'),uz=specMap(e.specs,'uz');
    const vals=new Map([...ru,...uz].map(([k,v])=>[k,v.value]));
    return {sku:String(e.yechim_sku||p.sku||''),brand:String(e.yechim_brand||p.brand||''),name:String(p.name||''),link:getLink(p.eman_id),desc:String(e.description||''),vals};
  }
  let loadingLibrary;
  function library(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(!loadingLibrary)loadingLibrary=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Библиотека Excel недоступна.'));
      s.onerror=()=>{s.remove();reject(new Error('Не удалось загрузить библиотеку Excel. Проверьте интернет.'));};document.head.appendChild(s);
    }).catch(e=>{loadingLibrary=null;throw e;});
    return loadingLibrary;
  }
  function status(message){$('#catalogExcelStatus').textContent=message;}
  function lock(value){$('#exportCharacteristicsBtn').disabled=value;$('#importCatalogBtn').disabled=value;}
  function sheetName(brand,used){
    const base=(brand||'Без бренда').replace(/[\\/:?*\[\]]/g,'_').replace(/^'+|'+$/g,'').slice(0,31)||'Товары';
    let n=base,i=1;while(used.has(n.toLowerCase()))n=base.slice(0,27)+' '+(++i);used.add(n.toLowerCase());return n;
  }
  async function download(){
    lock(true);
    try{
      if(!products.length)throw new Error('Сначала дождитесь загрузки товаров.');
      const X=await library(),wb=X.utils.book_new(),groups=new Map(),used=new Set();
      for(const p of products){const r=rowsFor(p,enrichment[p.eman_id]||{});if(!groups.has(r.brand))groups.set(r.brand,[]);groups.get(r.brand).push(r);}
      for(const [brand,items] of groups){
        const ru=new Set(),uz=new Set();
        for(const r of items)for(const k of r.vals.keys())(k.endsWith(' · RU')?ru:uz).add(k);
        const headers=[...fixed,...ru,...uz];
        const data=[headers,...items.map(r=>[r.sku,r.brand,r.name,r.link,r.desc,...headers.slice(fixed.length).map(k=>r.vals.get(k)??'')])];
        const ws=X.utils.aoa_to_sheet(data);
        ws['!cols']=headers.map((h,i)=>({wch:[20,23,55,72,45][i]||Math.min(48,Math.max(20,h.length+3))}));
        ws['!autofilter']={ref:ws['!ref']};
        items.forEach((r,i)=>{const c=ws[X.utils.encode_cell({r:i+1,c:3})];if(c)c.l={Target:r.link};});
        X.utils.book_append_sheet(wb,ws,sheetName(brand,used));
      }
      X.writeFileXLSX(wb,'YECHIM_Catalog_'+new Date().toISOString().slice(0,10)+'.xlsx',{compression:true});
      status('Каталог скачан: '+products.length+' товаров, '+groups.size+' листов.');
    }catch(e){status('Ошибка: '+e.message);}finally{lock(false);}
  }
  function parseWorkbook(X,wb,productList,latest){
    const byId=new Map(productList.map(p=>[String(p.eman_id),p])),seen=new Set(),changes=[],errors=[];
    let total=0;
    for(const sheet of wb.SheetNames){
      const ws=wb.Sheets[sheet];if(!ws['!ref'])continue;
      const range=X.utils.decode_range(ws['!ref']);
      if(range.e.r>20000||range.e.c>2000)throw new Error('Слишком большой лист: '+sheet);
      const grid=X.utils.sheet_to_json(ws,{header:1,defval:'',blankrows:true,raw:true});
      if(!grid.length)continue;
      const headers=grid[0].map(text),index=new Map();
      try{
        for(let i=0;i<headers.length;i++){const h=headers[i];if(!h)continue;if(index.has(h))throw new Error('Дублирующийся столбец: '+h);index.set(h,i);}
        if(!index.has(H.link))throw new Error('Нет столбца «'+H.link+'». Используйте скачанный каталог.');
        const cols=[...index].filter(([h])=>!fixed.includes(h)).map(([h,i])=>({h,i,meta:parseHeader(h)}));
        const unknown=cols.filter(c=>!c.meta);if(unknown.length)throw new Error('Неизвестный столбец: '+unknown[0].h+'. Новые характеристики назовите «Название · RU» или «Nomi · UZ».');
        for(let r=1;r<grid.length;r++){
          const row=grid[r];if(!row.some(v=>text(v)))continue;
          total++;
          try{
            const at=h=>row[index.get(h)]??'';
            const val=h=>text(at(h));
            const u=new URL(val(H.link),location.href);
            const root=new URL('../',location.href);
            if(u.origin!==root.origin||u.pathname!==root.pathname)throw new Error('Ссылка не относится к YECHIM E-Catalog.');
            const id=u.searchParams.get('product'),p=byId.get(id),e=latest[id];
            if(!p||!e)throw new Error('Товар не найден: '+(id||val(H.link)));
            if(seen.has(id))throw new Error('Товар повторяется в файле: '+id);seen.add(id);
            if(index.has(H.name)&&val(H.name)!==text(p.name))throw new Error('Наименование изменено или товар не совпадает со ссылкой. Наименование синхронизируется с Eman.uz.');
            const patch={};
            for(const [h,key,prev] of [[H.sku,'yechim_sku',e.yechim_sku||p.sku||''],[H.brand,'yechim_brand',e.yechim_brand||p.brand||''],[H.desc,'description',e.description||'']]){
              if(!index.has(h))continue;
              const v=val(h);
              if(v!==text(prev))patch[key]=v||null;
            }
            const maps={ru:specMap(e.specs,'ru'),uz:specMap(e.specs,'uz')};
            const before={ru:new Map(maps.ru),uz:new Map(maps.uz)};
            let specsChanged=false;
            for(const {h,i,meta} of cols){
              const cell=ws[X.utils.encode_cell({r:r+range.s.r,c:i+range.s.c})];
              if(cell?.f)throw new Error('Формулы в характеристиках не поддерживаются: '+h);
              const v=text(row[i]),m=maps[meta.lang],old=m.get(h);
              if(v===text(old?.value))continue;
              if(/[\r\n]/.test(v))throw new Error('Характеристика должна быть одной строкой: '+h);
              specsChanged=true;
              if(v)m.set(h,{name:meta.name,value:v});else m.delete(h);
            }
            if(specsChanged){
              const toRows=m=>[...m.values()];
              const updated=updateCatalogCharacteristics(e.specs,toRows(maps.ru),toRows(maps.uz));
              if(updated!==e.specs)patch.specs=updated;
            }
            if(Object.keys(patch).length)changes.push({id,patch,version:e.updated_at,label:p.name});
          }catch(err){errors.push(sheet+'!'+(r+1)+': '+err.message);}
        }
      }catch(err){errors.push(sheet+': '+err.message);}
    }
    return {total,changes,errors};
  }
  async function upload(file){
    if(!file)return;
    lock(true);
    try{
      if(!/\.xlsx$/i.test(file.name)||file.size>20*1024*1024)throw new Error('Выберите XLSX размером до 20 МБ.');
      status('Проверка файла и актуальных данных…');
      const X=await library();
      const wb=X.read(await file.arrayBuffer(),{type:'array',cellFormula:true});
      const [p,e]=await Promise.all([fetchAll('eman_products','name'),fetchAll('yechim_enrichment')]);
      const latest=Object.fromEntries(e.map(row=>[row.eman_id,row]));
      const report=parseWorkbook(X,wb,p,latest);
      if(report.errors.length){status('Импорт отменён. Ошибок: '+report.errors.length+'\n'+report.errors.slice(0,25).join('\n'));return;}
      if(!report.changes.length){status('Проверено '+report.total+' товаров. Изменений нет.');return;}
      if(!confirm('Проверено товаров: '+report.total+'\nБудет обновлено: '+report.changes.length+'\nЦены, остатки и остальные данные не меняются.\nПродолжить?')){status('Импорт отменён. Данные не изменены.');return;}
      const failed=[];let done=0;
      for(let i=0;i<report.changes.length;i+=8){
        const chunk=report.changes.slice(i,i+8);
        await Promise.all(chunk.map(async c=>{
          try{
            let q=sb.from('yechim_enrichment').update(c.patch).eq('eman_id',c.id);
            if(c.version)q=q.eq('updated_at',c.version);
            const {data,error}=await q.select('eman_id').single();
            if(error||!data)throw new Error(error?.message||'Запись изменилась или недоступна.');
            done++;
          }catch(err){failed.push(c.id+': '+err.message);}
        }));
        status('Импорт: '+Math.min(i+chunk.length,report.changes.length)+' / '+report.changes.length);
      }
      await loadData();
      status('Обновлено: '+done+'. Без изменений: '+(report.total-report.changes.length)+'. Ошибок записи: '+failed.length+(failed.length?'\n'+failed.slice(0,25).join('\n')+'\nПовторите импорт после проверки.':''));
    }catch(e){status('Ошибка импорта: '+e.message);}finally{lock(false);}
  }
  $('#exportCharacteristicsBtn').onclick=download;
  $('#importCatalogBtn').onclick=()=>$('#importCatalogFile').click();
  $('#importCatalogFile').onchange=e=>{const file=e.target.files[0];e.target.value='';void upload(file);};
})();
