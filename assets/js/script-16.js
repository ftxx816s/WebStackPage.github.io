
(()=>{
  'use strict';
  const root=document.documentElement;
  const BG_KEY='fxnav_liquid_background_v1920_raw';
  const BG_DB='fxnav_liquid_background_db';
  const BG_STORE='backgrounds';
  const BG_RECORD='custom';
  const DEFAULTS={opacity:32,clarity:78,edge:8};
  const $=id=>document.getElementById(id);
  const panel=()=>$('liquidGlassSettings');
  const bgInput=()=>$('liquidBgInput');
  const controls={opacity:()=>$('liquidGlassOpacity'),clarity:()=>$('liquidGlassClarity'),edge:()=>$('liquidGlassEdgeStrength')};
  let dbPromise=null;
  let currentObjectUrl='';
  let preferenceWriteTimer=0;
  const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
  const toastSafe=msg=>{try{if(typeof toast==='function')toast(msg)}catch{}};
  function currentPrefs(){return {
    opacity:clamp(controls.opacity()?.value,0,100,DEFAULTS.opacity),
    clarity:clamp(controls.clarity()?.value,0,100,DEFAULTS.clarity),
    edge:clamp(controls.edge()?.value,0,40,DEFAULTS.edge)
  }}
  function applyMaterial({persist=false,push=false}={}){
    const p=currentPrefs();
    const fill=.035+(p.opacity/100)*.17;
    const blur=6*(1-p.clarity/100);
    const rim=p.edge/40;
    root.style.setProperty('--liquid-glass-opacity',fill.toFixed(3));
    root.style.setProperty('--liquid-glass-fill-alpha',fill.toFixed(3));
    root.style.setProperty('--liquid-glass-fill-light-alpha',(fill*.52).toFixed(3));
    root.style.setProperty('--liquid-glass-fill-dark-alpha',Math.min(.26,fill*1.12).toFixed(3));
    root.style.setProperty('--liquid-calendar-fill-alpha',(.13+(p.opacity/100)*.12).toFixed(3));
    root.style.setProperty('--liquid-glass-clarity',(p.clarity/100).toFixed(2));
    root.style.setProperty('--liquid-glass-blur',blur.toFixed(2)+'px');
    root.style.setProperty('--liquid-glass-current-blur',blur.toFixed(2)+'px');
    root.style.setProperty('--liquid-rim-level',rim.toFixed(3));
    root.style.setProperty('--liquid-border-alpha',(.15+rim*.075).toFixed(3));
    root.style.setProperty('--liquid-top-rim-alpha',(.045+rim*.055).toFixed(3));
    root.style.setProperty('--liquid-side-rim-alpha',(.018+rim*.025).toFixed(3));
    const outOpacity=$('liquidGlassOpacityValue'),outClarity=$('liquidGlassClarityValue'),outEdge=$('liquidGlassEdgeStrengthValue');
    if(outOpacity)outOpacity.value=p.opacity+'%';
    if(outClarity)outClarity.value=p.clarity+'%';
    if(outEdge)outEdge.value=p.edge+'%';
    if(persist){
      const record={...p,updatedAt:Date.now()};
      try{writeLiquidPrefsV1927(record,false);saveLocalLiquidToStatsV1927()}catch{}
    }
    if(push){
      clearTimeout(preferenceWriteTimer);
      preferenceWriteTimer=setTimeout(()=>{try{window.__fxCloudSchedulePush?.()}catch{}},250);
    }
  }
  function loadMaterial(){
    let p=null;try{p=localLiquidPrefsV1927()}catch{}
    p=p||{...DEFAULTS};
    if(controls.opacity())controls.opacity().value=String(p.opacity);
    if(controls.clarity())controls.clarity().value=String(p.clarity);
    if(controls.edge())controls.edge().value=String(Math.min(40,p.edge));
    applyMaterial();
  }
  window.__fxLiquidRefreshV1927=()=>{
    let p=null;try{p=localLiquidPrefsV1927()}catch{}
    if(!p)return;
    if(controls.opacity())controls.opacity().value=String(p.opacity);
    if(controls.clarity())controls.clarity().value=String(p.clarity);
    if(controls.edge())controls.edge().value=String(Math.min(40,p.edge));
    applyMaterial();
  };
  function openBgDb(){
    if(!('indexedDB' in window))return Promise.reject(new Error('indexeddb-unavailable'));
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(BG_DB,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(BG_STORE))db.createObjectStore(BG_STORE);
      };
      request.onsuccess=()=>{
        const db=request.result;
        db.onversionchange=()=>db.close();
        resolve(db);
      };
      request.onerror=()=>reject(request.error||new Error('indexeddb-open-failed'));
      request.onblocked=()=>reject(new Error('indexeddb-blocked'));
    });
    return dbPromise;
  }
  function readBgRecord(){
    return openBgDb().then(db=>new Promise((resolve,reject)=>{
      let value=null;
      let tx;
      try{
        tx=db.transaction(BG_STORE,'readonly');
        const request=tx.objectStore(BG_STORE).get(BG_RECORD);
        request.onsuccess=()=>{value=request.result||null};
        request.onerror=()=>reject(request.error||new Error('indexeddb-read-failed'));
        tx.oncomplete=()=>resolve(value);
        tx.onerror=()=>reject(tx.error||new Error('indexeddb-read-failed'));
        tx.onabort=()=>reject(tx.error||new Error('indexeddb-read-aborted'));
      }catch(err){reject(err)}
    }));
  }
  function writeBgRecord(blob){
    return openBgDb().then(db=>new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction(BG_STORE,'readwrite');
        tx.objectStore(BG_STORE).put(blob,BG_RECORD);
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>reject(tx.error||new Error('indexeddb-write-failed'));
        tx.onabort=()=>reject(tx.error||new Error('indexeddb-write-aborted'));
      }catch(err){reject(err)}
    }));
  }
  function deleteBgRecord(){
    return openBgDb().then(db=>new Promise((resolve,reject)=>{
      let tx;
      try{
        tx=db.transaction(BG_STORE,'readwrite');
        tx.objectStore(BG_STORE).delete(BG_RECORD);
        tx.oncomplete=()=>resolve(true);
        tx.onerror=()=>reject(tx.error||new Error('indexeddb-delete-failed'));
        tx.onabort=()=>reject(tx.error||new Error('indexeddb-delete-aborted'));
      }catch(err){reject(err)}
    }));
  }
  function dataUrlToBlob(dataUrl){
    const match=/^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl||'');
    if(!match)throw new Error('legacy-image-invalid');
    const mime=match[1]||'application/octet-stream';
    if(match[2]){
      const binary=atob(match[3]);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new Blob([bytes],{type:mime});
    }
    return new Blob([decodeURIComponent(match[3])],{type:mime});
  }
  function applyBackgroundBlob(blob){
    if(currentObjectUrl){try{URL.revokeObjectURL(currentObjectUrl)}catch{}currentObjectUrl='';}
    if(blob&&typeof blob.size==='number'&&String(blob.type||'').startsWith('image/')){
      currentObjectUrl=URL.createObjectURL(blob);
      root.style.setProperty('--liquid-bg-image',`url("${currentObjectUrl}")`);
    }else{
      root.style.removeProperty('--liquid-bg-image');
    }
  }
  async function applySavedBackground(){
    try{
      const saved=await readBgRecord();
      if(saved&&typeof saved.size==='number'&&String(saved.type||'').startsWith('image/')){
        applyBackgroundBlob(saved);
        return;
      }
    }catch{}
    /* Migrate a custom background saved by V19.20 without altering its pixels. */
    let legacy='';try{legacy=localStorage.getItem(BG_KEY)||''}catch{}
    if(legacy.startsWith('data:image/')){
      try{
        const blob=dataUrlToBlob(legacy);
        await writeBgRecord(blob);
        applyBackgroundBlob(blob);
        try{localStorage.removeItem(BG_KEY)}catch{}
        return;
      }catch{
        /* Legacy fallback: show the stored original even if IndexedDB is blocked. */
        root.style.setProperty('--liquid-bg-image',`url("${legacy.replace(/"/g,'\\"')}")`);
        return;
      }
    }
    root.style.removeProperty('--liquid-bg-image');
  }

  function openPanel(anchor){
    const p=panel();if(!p)return;
    p.hidden=false;
    requestAnimationFrame(()=>{
      const r=anchor?.getBoundingClientRect?.();
      if(r){
        const w=p.offsetWidth||280;
        const left=Math.min(window.innerWidth-w-14,Math.max(14,r.right-w));
        const top=Math.min(window.innerHeight-(p.offsetHeight||220)-14,r.bottom+10);
        p.style.left=`${left}px`;
        p.style.top=`${Math.max(12,top)}px`;
      }
    });
  }
  function closePanel(){const p=panel();if(p)p.hidden=true}
  function togglePanel(anchor){const p=panel();if(!p)return;p.hidden?openPanel(anchor):closePanel()}
  function bindTrigger(el){
    if(!el||el.dataset.liquidGlassBound)return;
    el.dataset.liquidGlassBound='1';
    el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();togglePanel(el)});
  }

  async function resetBackground(){
    let removed=false;
    try{await deleteBgRecord();removed=true}catch{}
    try{localStorage.removeItem(BG_KEY)}catch{}
    if(currentObjectUrl){try{URL.revokeObjectURL(currentObjectUrl)}catch{}currentObjectUrl='';}
    root.style.removeProperty('--liquid-bg-image');
    toastSafe(removed?'已恢复液态主题默认背景':'已切换为默认背景；浏览器未能确认清除已保存的自定义图片');
  }
  async function handleUpload(file){
    if(!file)return;
    if(!String(file.type||'').startsWith('image/')){toastSafe('请选择 PNG、JPG、WebP 等图片文件');return}
    if(file.size>100*1024*1024){toastSafe('图片超过 100 MB，请选择较小的原图');return}
    try{
      /* Store the original File/Blob directly. No canvas, resizing, base64 expansion or re-encoding. */
      await writeBgRecord(file);
      applyBackgroundBlob(file);
      try{localStorage.removeItem(BG_KEY)}catch{}
      toastSafe(`原图已保存并应用：${file.name||'自定义背景'} · 未压缩、未重新编码`);
    }catch{
      /* Still let the user preview the original during this session if persistence is blocked. */
      applyBackgroundBlob(file);
      toastSafe('原图已临时应用，但浏览器存储失败；刷新页面后可能恢复默认背景');
    }
  }


  function init(){
    /* Keep original background bytes: packaged 1920×1080 PNG stays untouched; custom files use IndexedDB. */
    try{localStorage.removeItem('fxnav_liquid_background_v1912')}catch{}
    void applySavedBackground();
    loadMaterial();
    bindTrigger($('liquidBgBtn'));
    bindTrigger($('compactLiquidBgBtn'));
    $('liquidGlassClose')?.addEventListener('click',closePanel);
    $('liquidGlassUpload')?.addEventListener('click',()=>bgInput()?.click());
    $('liquidGlassReset')?.addEventListener('click',()=>{void resetBackground()});
    for(const getInput of Object.values(controls)){
      const input=getInput();if(!input||input.dataset.v1927Bound)continue;
      input.dataset.v1927Bound='1';
      input.addEventListener('input',()=>applyMaterial({persist:true,push:false}));
      input.addEventListener('change',()=>applyMaterial({persist:true,push:true}));
    }
    const input=bgInput();
    if(input&&!input.dataset.v1927Bound){
      input.dataset.v1927Bound='1';
      input.addEventListener('change',async()=>{const file=input.files?.[0];if(file)await handleUpload(file);input.value=''});
    }
    document.addEventListener('pointerdown',e=>{
      const p=panel();if(!p||p.hidden)return;
      if(p.contains(e.target)||e.target.closest?.('#liquidBgBtn,#compactLiquidBgBtn'))return;
      closePanel();
    },{passive:true});
    const themeObs=new MutationObserver(()=>{if(root.dataset.theme!=='liquid')closePanel()});
    themeObs.observe(root,{attributes:true,attributeFilter:['data-theme']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
