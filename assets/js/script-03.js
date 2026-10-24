

/* V15.1 built-in bookmarks: 191 sites / 20 functional categories / source: 收藏夹2026_8_26(1).html */
let BUILTIN_SITES=[];
let CATEGORIES=[]; ICON_MAP={"all":"⌂","favorite":"★","recent":"↺","常用·搜索":"⌘","AI 助手·聚合":"✦","AI 图像·视频":"◉","设计·灵感":"✎","素材·字体·PPT":"▣","图片·文档工具":"◫","工具·导航":"◇","开发·技术":"⌨","软件·系统":"⌬","网络·测速·IP":"◎","VPN·代理":"↯","影音·直播":"▶","游戏·资源":"◆","学习·知识":"✧","政务·法律":"§","电商·购物":"◌","账号·订阅":"◍","生活·出行":"⌖","社交·社区":"◈","文件·下载·传输":"⇩","其他收藏":"···"};

/* Stable storage + migration from previous versions */

const STORE={
  get(key){try{return localStorage.getItem(key)}catch{return null}},
  set(key,value){try{localStorage.setItem(key,value);return true}catch{return false}},
  remove(key){try{localStorage.removeItem(key);return true}catch{return false}}
};
function parseStored(key,fallback){
  const raw=STORE.get(key);
  if(raw===null)return fallback;
  try{return JSON.parse(raw)}catch{return fallback}
}
function cloneJSON(v){return JSON.parse(JSON.stringify(v))}
function validHttpUrl(value){
  try{const u=new URL(String(value||"").trim());return /^https?:$/.test(u.protocol)?u:null}catch{return null}
}
function validIconValue(value){
  const v=String(value||"").trim();
  if(!v)return "";
  if(/^https?:\/\//i.test(v))return v.length<=4096?v:"";
  if(/^\/api\//i.test(v))return v.length<=4096?v:"";
  if(/^data:image\/(?:png|jpe?g|webp|gif|x-icon|vnd\.microsoft\.icon);base64,/i.test(v))return v.length<=700000?v:"";
  return "";
}
function canonicalUrl(value){
  const u=validHttpUrl(value);if(!u)return "";
  u.hash="";
  if(u.pathname!=="/")u.pathname=u.pathname.replace(/\/+$/,"");
  return u.href;
}

const KEYS={theme:"fxnav_theme",favorites:"fxnav_favorites",recents:"fxnav_recents",custom:"fxnav_custom",categoryOverrides:"fxnav_category_overrides",iconOverrides:"fxnav_icon_overrides",hiddenSites:"fxnav_hidden_sites",siteEdits:"fxnav_site_edits",customCategories:"fxnav_custom_categories",categoryOrder:"fxnav_category_order",categoryIconOverrides:"fxnav_category_icon_overrides",siteOrder:"fxnav_site_order"};
const LEGACY={
  theme:["feitianxiaoxiang_theme_v5","dumbo_theme_v4","dumbo_theme_v3","dumbo_theme_v2","dumbo_theme"],
  favorites:["feitianxiaoxiang_favorites_v5","dumbo_favorites"],
  recents:["feitianxiaoxiang_recents_v5","dumbo_recents"],
  custom:["feitianxiaoxiang_custom_v5","dumbo_custom"],
  categoryOverrides:[],
  iconOverrides:[],
  hiddenSites:[],
  siteEdits:[],
  customCategories:[],
  categoryOrder:[],
  categoryIconOverrides:[],
  siteOrder:[]
};
function migrateOne(key,legacy=[]){
  if(STORE.get(key)!==null)return;
  for(const old of legacy){const v=STORE.get(old);if(v!==null){STORE.set(key,v);break;}}
}
Object.keys(KEYS).forEach(k=>migrateOne(KEYS[k],LEGACY[k]));

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={
  filter:"all",query:"",pendingIconData:"",
  favorites:new Set(Array.isArray(parseStored(KEYS.favorites,[]))?parseStored(KEYS.favorites,[]):[]),
  recents:Array.isArray(parseStored(KEYS.recents,[]))?parseStored(KEYS.recents,[]):[],
  custom:Array.isArray(parseStored(KEYS.custom,[]))?parseStored(KEYS.custom,[]):[],
  categoryOverrides:(parseStored(KEYS.categoryOverrides,{})&&typeof parseStored(KEYS.categoryOverrides,{})==="object")?parseStored(KEYS.categoryOverrides,{}):{},
  iconOverrides:(parseStored(KEYS.iconOverrides,{})&&typeof parseStored(KEYS.iconOverrides,{})==="object")?parseStored(KEYS.iconOverrides,{}):{},
  hiddenSites:new Set(Array.isArray(parseStored(KEYS.hiddenSites,[]))?parseStored(KEYS.hiddenSites,[]):[]),
  siteEdits:(parseStored(KEYS.siteEdits,{})&&typeof parseStored(KEYS.siteEdits,{})==="object")?parseStored(KEYS.siteEdits,{}):{},
  customCategories:Array.isArray(parseStored(KEYS.customCategories,[]))?parseStored(KEYS.customCategories,[]):[],
  categoryOrder:Array.isArray(parseStored(KEYS.categoryOrder,[]))?parseStored(KEYS.categoryOrder,[]):[],
  categoryIconOverrides:(parseStored(KEYS.categoryIconOverrides,{})&&typeof parseStored(KEYS.categoryIconOverrides,{})==="object")?parseStored(KEYS.categoryIconOverrides,{}):{},
  siteOrder:(parseStored(KEYS.siteOrder,{})&&typeof parseStored(KEYS.siteOrder,{})==="object")?parseStored(KEYS.siteOrder,{}):{},
  sortMode:false
};
function save(){
  const entries=[
    [KEYS.favorites,JSON.stringify([...state.favorites])],
    [KEYS.recents,JSON.stringify(state.recents.slice(0,30))],
    [KEYS.custom,JSON.stringify(state.custom)],
    [KEYS.categoryOverrides,JSON.stringify(state.categoryOverrides)],
    [KEYS.iconOverrides,JSON.stringify(state.iconOverrides)],
    [KEYS.hiddenSites,JSON.stringify([...state.hiddenSites])]
  ];
  const previous=new Map(entries.map(([k])=>[k,STORE.get(k)]));
  try{
    for(const [k,v] of entries){
      if(!STORE.set(k,v))throw new Error("storage");
    }
    updateStorageUsage();
    return true;
  }catch(err){
    for(const [k,v] of previous){
      if(v===null)STORE.remove(k);else STORE.set(k,v);
    }
    try{
      state.favorites=new Set(previous.get(KEYS.favorites)?JSON.parse(previous.get(KEYS.favorites)):[]);
      state.recents=previous.get(KEYS.recents)?JSON.parse(previous.get(KEYS.recents)):[];
      state.custom=previous.get(KEYS.custom)?JSON.parse(previous.get(KEYS.custom)):[];
      state.categoryOverrides=previous.get(KEYS.categoryOverrides)?JSON.parse(previous.get(KEYS.categoryOverrides)):{};
      state.iconOverrides=previous.get(KEYS.iconOverrides)?JSON.parse(previous.get(KEYS.iconOverrides)):{};
      state.hiddenSites=new Set(previous.get(KEYS.hiddenSites)?JSON.parse(previous.get(KEYS.hiddenSites)):[]);
    }catch{}
    toast("本地存储空间不足，修改未保存");
    updateStorageUsage();
    return false;
  }
}
function rawSites(){return [...BUILTIN_SITES,...state.custom]}
function allSites(){return rawSites().filter(site=>!state.hiddenSites.has(site.id))}
function effectiveCategory(site){return state.categoryOverrides[site.id]||site.category}

function sanitizeState(){
  const builtinIds=new Set(BUILTIN_SITES.map(s=>s.id));
  const used=new Set(builtinIds);
  const cleanCustom=[];
  for(const item of state.custom){
    if(!item||typeof item!=="object")continue;
    const u=validHttpUrl(item.url);
    const name=String(item.name||"").trim();
    if(!u||!name)continue;
    let id=String(item.id||"");
    if(!id||used.has(id))id="c"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    used.add(id);
    cleanCustom.push({
      ...item,id,name,url:u.href,domain:u.hostname.replace(/^www\./,""),
      category:String(item.category||CATEGORIES[0]?.name||"常用入口"),
      icon:validIconValue(item.icon),
      iconUrl:validIconValue(item.iconUrl)
    });
  }
  state.custom=cleanCustom;
  const ids=new Set([...BUILTIN_SITES.map(s=>s.id),...state.custom.map(s=>s.id)]);
  state.hiddenSites=new Set([...state.hiddenSites].filter(id=>ids.has(id)));
  state.favorites=new Set([...state.favorites].filter(id=>ids.has(id)&&!state.hiddenSites.has(id)));
  state.recents=[...new Set(state.recents)].filter(id=>ids.has(id)&&!state.hiddenSites.has(id)).slice(0,30);

  const catNames=new Set(CATEGORIES.map(c=>c.name));
  const baseById=new Map([...BUILTIN_SITES,...state.custom].map(s=>[s.id,s]));
  const cleanCats={};
  for(const [id,cat] of Object.entries(state.categoryOverrides||{})){
    const base=baseById.get(id);
    if(base&&catNames.has(cat)&&cat!==base.category)cleanCats[id]=cat;
  }
  state.categoryOverrides=cleanCats;

  const cleanIcons={};
  for(const [id,val] of Object.entries(state.iconOverrides||{})){
    if(ids.has(id)){
      const safe=validIconValue(val);
      if(safe)cleanIcons[id]=safe;
    }
  }
  state.iconOverrides=cleanIcons;
}
function storageBytes(){
  let chars=0;
  Object.values(KEYS).forEach(k=>{const v=STORE.get(k);if(v)chars+=v.length});
  return chars*2;
}
function updateStorageUsage(){
  const el=$("#storageUsage");if(!el)return;
  const bytes=storageBytes();
  const kb=bytes/1024;
  el.className=kb>3500?"storage-danger":kb>2200?"storage-warn":"storage-ok";
  el.textContent=`本地配置占用约 ${kb<1024?kb.toFixed(0)+" KB":(kb/1024).toFixed(2)+" MB"}。图标上传过多时建议定期导出备份。`;
}

function categoryCount(name){return allSites().filter(site=>effectiveCategory(site)===name).length}
function movedCount(){return Object.keys(state.categoryOverrides).filter(id=>rawSites().some(s=>s.id===id)).length}
function safeDomain(url){try{return new URL(url).hostname.replace(/^www\./,"")}catch{return ""}}
function hashCode(str){let h=0;for(let i=0;i<str.length;i++)h=str.charCodeAt(i)+((h<<5)-h);return Math.abs(h)}
function gradientFor(str){
  const p=[["#7084ff","#9b5cf5"],["#06b6d4","#3b82f6"],["#14b8a6","#22c55e"],["#f97316","#ef4444"],["#ec4899","#8b5cf6"],["#22c55e","#15803d"],["#eab308","#f97316"],["#0ea5e9","#6366f1"]];
  return p[hashCode(str)%p.length];
}
function iconSources(site){
  const out=[];
  const seen=new Set();
  const add=(url,opts={})=>{
    const clean=validIconValue(url);
    if(!clean||seen.has(clean))return;
    seen.add(clean);
    out.push({
      url:clean,
      minSize:Number(opts.minSize||0),
      kind:String(opts.kind||"auto")
    });
  };

  const d=site.domain||safeDomain(site.url);
  if(!d)return out;

  // V15.6：外网高清图标优先。
  // 开 VPN 时优先拿更清晰的第三方图标；失败后继续尝试网站自身图标。
  add("https://www.google.com/s2/favicons?sz=256&domain_url="+encodeURIComponent(site.url),
      {minSize:64,kind:"google-256"});
  add("https://icon.horse/icon/"+encodeURIComponent(d),
      {minSize:48,kind:"icon-horse"});
  add("https://icons.duckduckgo.com/ip3/"+encodeURIComponent(d)+".ico",
      {minSize:32,kind:"duckduckgo"});

  try{
    const u=new URL(site.url);
    add(u.origin+"/apple-touch-icon.png",{minSize:64,kind:"apple-touch"});
    add(u.origin+"/apple-touch-icon-precomposed.png",{minSize:64,kind:"apple-touch"});
    add(u.origin+"/android-chrome-512x512.png",{minSize:128,kind:"android-512"});
    add(u.origin+"/android-chrome-192x192.png",{minSize:96,kind:"android-192"});
    add(u.origin+"/favicon-196x196.png",{minSize:96,kind:"favicon-196"});
    add(u.origin+"/favicon-128.png",{minSize:64,kind:"favicon-128"});
    add(u.origin+"/favicon.png",{minSize:48,kind:"favicon-png"});
    add(u.origin+"/favicon.ico",{minSize:32,kind:"favicon-ico"});
  }catch{}

  return out;
}

let __iconUpgradeObserver=null;
function getIconUpgradeObserver(){
  if(__iconUpgradeObserver)return __iconUpgradeObserver;
  if(!("IntersectionObserver" in window))return null;

  __iconUpgradeObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      const wrap=entry.target;
      __iconUpgradeObserver.unobserve(wrap);
      const run=wrap.__startIconUpgrade;
      if(typeof run==="function")run();
    }
  },{rootMargin:"110px 0px"});
  return __iconUpgradeObserver;
}

function createSiteIcon(site,className="site-icon"){
  const wrap=document.createElement("div");
  wrap.className=className;

  const fb=document.createElement("span");
  fb.className="site-fallback";

  const rawName=(site.name||site.domain||"?").trim();
  const d=(site.domain||safeDomain(site.url)||"").replace(/^www\./,"");
  const asciiInitial=(rawName.match(/[A-Za-z0-9]/)||[])[0];
  const label=(asciiInitial||rawName.charAt(0)||d.charAt(0)||"?").toUpperCase();

  const colors=gradientFor((d||"")+(rawName||""));
  fb.textContent=label;
  fb.style.background=`linear-gradient(135deg,${colors[0]},${colors[1]})`;
  wrap.append(fb);

  wrap.classList.add("fallback-mode");
  wrap.dataset.iconQuality="vector";

  const override=validIconValue(state.iconOverrides?.[site.id]);
  const own=validIconValue(site.icon);
  const urlIcon=validIconValue(site.iconUrl);
  const id=String(site.id||"");
  const builtIn=id.startsWith("v15_");

  const img=document.createElement("img");
  img.alt="";
  img.decoding="async";
  img.referrerPolicy="no-referrer";
  img.loading="lazy";

  const showVector=()=>{
    img.remove();
    fb.classList.remove("is-hidden");
    wrap.classList.remove("favicon-mode","icon-upgrading");
    wrap.classList.add("fallback-mode","is-lowres-rejected");
    wrap.dataset.iconQuality="vector";
    wrap.removeAttribute("data-icon-source");
  };

  const setImage=(url,quality="hd",minSize=0,timeout=2800)=>{
    return new Promise(resolve=>{
      const probe=new Image();
      probe.decoding="async";
      probe.referrerPolicy="no-referrer";

      let settled=false;
      const finish=v=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        probe.onload=probe.onerror=null;
        resolve(v);
      };
      const timer=setTimeout(()=>finish(false),timeout);

      probe.onload=()=>{
        const natural=Math.max(probe.naturalWidth||0,probe.naturalHeight||0);
        if(quality!=="custom" && minSize && natural<minSize){
          finish(false);
          return;
        }

        img.onload=()=>{
          fb.classList.add("is-hidden");
          wrap.classList.remove("fallback-mode","is-lowres-rejected","icon-upgrading");
          wrap.classList.add("favicon-mode");
          wrap.dataset.iconQuality=quality;
          finish(true);
        };
        img.onerror=()=>finish(false);

        if(!img.isConnected)wrap.append(img);
        img.src=url;
      };

      probe.onerror=()=>finish(false);
      probe.src=url;
    });
  };

  // 用户自己上传/指定的图标始终最高优先级。
  // V17 的同源图标代理不再一次性请求全部 191 个图标：进入视口附近后才加载，
  // 并且不再额外创建 probe Image 做二次解码，显著降低首屏和滚动抖动。
  const fixedIcon=override||urlIcon||(!builtIn?own:"");
  if(fixedIcon){
    const isV17Proxy=String(fixedIcon).startsWith("/api/data?mode=icon");
    const loadFixed=()=>{
      if(isV17Proxy){
        if(img.isConnected)return;
        img.loading="eager";
        img.fetchPriority="low";
        img.onload=()=>{
          fb.classList.add("is-hidden");
          wrap.classList.remove("fallback-mode","is-lowres-rejected","icon-upgrading");
          wrap.classList.add("favicon-mode");
          wrap.dataset.iconQuality=site._customIcon?"custom":"cached-hd";
        };
        img.onerror=()=>showVector();
        wrap.classList.add("icon-upgrading");
        wrap.append(img);
        img.src=fixedIcon;
      }else{
        setImage(fixedIcon,"custom",0,2200).then(ok=>{if(!ok)showVector()});
      }
    };
    if(isV17Proxy){
      wrap.__startIconUpgrade=loadFixed;
      const observer=getIconUpgradeObserver();
      if(observer)observer.observe(wrap);
      else setTimeout(loadFixed,40);
    }else loadFixed();
    return wrap;
  }

  const sources=iconSources(site);
  let started=false;

  const startUpgrade=async()=>{
    if(started)return;
    started=true;
    wrap.classList.add("icon-upgrading");

    // 1) 外网高清图标优先
    for(const current of sources){
      const ok=await setImage(current.url,"hd",current.minSize||32,2600);
      if(ok){
        wrap.dataset.iconSource=current.kind||"auto";
        wrap.classList.remove("icon-upgrading");
        return;
      }
    }

    // 2) 全部外网/站点高清源失败后，使用收藏夹自带图标
    //    只要能显示就保底，避免不开 VPN 时出现空白。
    if(own){
      const ok=await setImage(own,"local",0,1200);
      if(ok){
        wrap.dataset.iconSource="embedded-bookmark";
        wrap.classList.remove("icon-upgrading");
        return;
      }
    }

    // 3) 最后使用永远清晰的矢量字母
    wrap.classList.remove("icon-upgrading");
    showVector();
  };

  wrap.__startIconUpgrade=startUpgrade;
  const observer=getIconUpgradeObserver();
  if(observer)observer.observe(wrap);
  else setTimeout(startUpgrade,60);

  return wrap;
}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove("show"),1800)}

/* V18.7 · shared context-menu helpers */
function contextCategoryLabelV187(name){
  const raw=String(name||"");
  const local=String(state?.categoryTitleOverrides?.[raw]||"").trim();
  if(local)return local;
  try{
    const fn=window.categoryDisplayNameV18;
    if(typeof fn==="function")return String(fn(raw)||raw);
  }catch{}
  return raw;
}
function createContextHeadIconV187(site){
  const frame=document.createElement("div");
  frame.className="context-head-icon";
  const source=createSiteIcon(site,"context-head-source");
  source.removeAttribute("title");
  source.querySelector(".longpress-ring")?.remove();
  frame.append(source);
  requestAnimationFrame(()=>source.__startIconUpgrade?.());
  return frame;
}

function recordRecent(id){
  const previous=[...state.recents];
  state.recents=[id,...state.recents.filter(x=>x!==id)].slice(0,30);
  try{
    const key="fxnav_usage_stats_v157";
    const stats=parseStored(key,{});
    const now=Date.now(),prev=stats[id]||{count:0,last:0};
    stats[id]={count:Math.min(99999,(Number(prev.count)||0)+1),last:now};
    STORE.set(key,JSON.stringify(stats));
  }catch{}
  const guest=typeof AUTH_V161!=="undefined"&&!AUTH_V161?.authenticated;
  const recentKey=guest?"fxnav_guest_recents_v178":KEYS.recents;
  if(!STORE.set(recentKey,JSON.stringify(state.recents))){
    state.recents=previous;
    toast("最近访问记录未保存");
  }else if(!guest&&window.__fxCloudSchedulePush){
    setTimeout(()=>window.__fxCloudSchedulePush?.(),0);
  }
  requestAnimationFrame(()=>{updateCounts();renderHeroRecent()});
}
function toggleFavorite(id){
  const wasFavorite=state.favorites.has(id);
  wasFavorite?state.favorites.delete(id):state.favorites.add(id);
  const guest=typeof AUTH_V161!=="undefined"&&!AUTH_V161?.authenticated;
  const favoritesKey=guest?"fxnav_guest_favorites_v178":KEYS.favorites;
  if(!STORE.set(favoritesKey,JSON.stringify([...state.favorites]))){
    wasFavorite?state.favorites.add(id):state.favorites.delete(id);
    toast("收藏状态未保存");
    return;
  }
  if(!guest&&window.__fxCloudSchedulePush)setTimeout(()=>window.__fxCloudSchedulePush?.(),0);
  if(state.filter==="favorite")render();
  else{
    document.querySelectorAll(`.card[data-site-id="${CSS.escape(id)}"] .star`).forEach(star=>{
      const on=state.favorites.has(id);
      star.classList.toggle("on",on);star.textContent=on?"★":"☆";star.title=on?"取消收藏":"收藏";star.setAttribute("aria-label",star.title);
    });
    updateCounts();syncMobileBottomBar();
  }
}
let suppressCardClickUntil=0;
function attachQuickManage(target,link,site){
  target.addEventListener("contextmenu",e=>{
    e.preventDefault();e.stopPropagation();openCategoryContext(e,site);
  });
  let timer=0,startX=0,startY=0;
  const cancel=()=>{clearTimeout(timer);timer=0;target.classList.remove("longpressing")};
  target.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch")return;
    startX=e.clientX;startY=e.clientY;
    target.classList.add("longpressing");
    timer=setTimeout(()=>{
      suppressCardClickUntil=Date.now()+700;
      openCategoryContext({clientX:startX,clientY:startY},site);
      target.classList.remove("longpressing");
      if(navigator.vibrate)navigator.vibrate(12);
    },520);
  },{passive:true});
  target.addEventListener("pointermove",e=>{
    if(timer&&Math.hypot(e.clientX-startX,e.clientY-startY)>10)cancel();
  },{passive:true});
  ["pointerup","pointercancel","pointerleave"].forEach(type=>target.addEventListener(type,cancel,{passive:true}));
  link.addEventListener("keydown",e=>{
    if(e.key==="ContextMenu"||(e.shiftKey&&e.key==="F10")){
      e.preventDefault();
      const r=target.getBoundingClientRect();
      openCategoryContext({clientX:r.left+r.width/2,clientY:r.top+r.height/2},site);
    }
  });
}
function createCard(site){
  const card=document.createElement("div");
  card.className="card glass";

  const link=document.createElement("a");
  link.className="card-link";
  link.href=site.url;
  link.target="_blank";
  link.rel="noopener noreferrer";
  link.referrerPolicy="no-referrer";
  link.title=site.fullTitle||site.name;
  link.onclick=e=>{
    if(Date.now()<suppressCardClickUntil){e.preventDefault();return}
    recordRecent(site.id);
  };

  const siteIcon=createSiteIcon(site);
  siteIcon.title="右键 / 长按：管理网站";
  const ring=document.createElement("span");ring.className="longpress-ring";siteIcon.append(ring);
  attachQuickManage(siteIcon,link,site);

  const copy=document.createElement("div");copy.className="site-copy";
  const n=document.createElement("div");n.className="site-name";n.textContent=site.name;
  const d=document.createElement("div");d.className="site-domain";d.textContent=site.domain||safeDomain(site.url);
  copy.append(n,d);
  link.append(siteIcon,copy);

  const star=document.createElement("button");
  star.type="button";
  star.className="star"+(state.favorites.has(site.id)?" on":"");
  star.textContent=state.favorites.has(site.id)?"★":"☆";
  star.title=state.favorites.has(site.id)?"取消收藏":"收藏";
  star.setAttribute("aria-label",star.title);
  star.onclick=e=>{e.preventDefault();e.stopPropagation();toggleFavorite(site.id)};

  card.append(link,star);
  return card;
}
function filteredSites(){
  const map=new Map(allSites().map(s=>[s.id,s]));let arr=allSites();
  if(state.filter==="favorite")arr=arr.filter(s=>state.favorites.has(s.id));
  else if(state.filter==="recent")arr=state.recents.map(id=>map.get(id)).filter(Boolean);
  else if(state.filter!=="all")arr=arr.filter(s=>effectiveCategory(s)===state.filter);
  const tokens=state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(tokens.length)arr=arr.filter(s=>{
    const hay=(`${s.name} ${s.domain} ${s.fullTitle||""} ${effectiveCategory(s)}`).toLowerCase();
    return tokens.every(t=>hay.includes(t));
  });
  return arr;
}
function sectionBlock(cat,items,icon){
  const sec=document.createElement("section");sec.className="section";
  const head=document.createElement("div");head.className="section-head";const title=document.createElement("div");title.className="section-title";
  const badge=document.createElement("span");badge.className="section-badge";renderCategoryIcon(badge,icon||"•");const h=document.createElement("h2");h.textContent=cat;
  const small=document.createElement("small");small.textContent="· "+items.length;h.append(small);title.append(badge,h);head.append(title);sec.append(head);
  const grid=document.createElement("div");grid.className="grid";items.forEach(s=>grid.append(createCard(s)));sec.append(grid);return sec;
}
function emptyBlock(text){const e=document.createElement("div");e.className="empty glass";e.textContent=text;return e}
function render(){
  const content=$("#content");
  const visible=filteredSites();
  const frag=document.createDocumentFragment();

  if(state.query.trim()){
    frag.append(visible.length?sectionBlock("搜索结果",visible,"⌕"):emptyBlock("没有找到匹配的网站"));
  }else if(state.filter==="favorite"){
    frag.append(visible.length?sectionBlock("我的收藏",visible,"★"):emptyBlock("还没有收藏网站"));
  }else if(state.filter==="recent"){
    frag.append(visible.length?sectionBlock("最近访问",visible,"↺"):emptyBlock("还没有最近访问记录"));
  }else if(state.filter!=="all"){
    const c=CATEGORIES.find(x=>x.name===state.filter);
    frag.append(visible.length?sectionBlock(state.filter,visible,c?.icon||"•"):emptyBlock("这个分类还没有网站"));
  }else{
    const groups=new Map();
    for(const site of visible){
      const cat=effectiveCategory(site);
      if(!groups.has(cat))groups.set(cat,[]);
      groups.get(cat).push(site);
    }

    for(const c of CATEGORIES){
      const group=groups.get(c.name);
      if(group?.length)frag.append(sectionBlock(c.name,group,c.icon));
      groups.delete(c.name);
    }

    for(const [cat,group] of groups){
      if(group.length)frag.append(sectionBlock(cat,group,"＋"));
    }
  }

  content.replaceChildren(frag);
  updateCounts();
}
function updateCounts(){
  $("#allCount").textContent=allSites().length;
  $("#favCount").textContent=state.favorites.size;
  $("#recentCount").textContent=state.recents.length;
  $("#siteCount").textContent=allSites().length;
  $("#catCount").textContent=new Set(allSites().map(s=>effectiveCategory(s))).size;
  $("#customCount").textContent=state.custom.filter(site=>!state.hiddenSites.has(site.id)).length+" 个";
  if($("#deletedCount"))$("#deletedCount").textContent=state.hiddenSites.size+" 个";
  if($("#movedCount"))$("#movedCount").textContent=movedCount()+" 个已调整";
  updateNavCounts();
}
function updateNavCounts(){
  $$("#categoryNav .nav-btn").forEach(btn=>{
    const el=btn.querySelector(".nav-count");
    if(el)el.textContent=categoryCount(btn.dataset.filter);
  });
}
function buildNav(){
  const box=$("#categoryNav");box.innerHTML="";
  CATEGORIES.forEach(c=>{const b=document.createElement("button");b.className="nav-btn";b.dataset.filter=c.name;
    const i=document.createElement("span");i.className="nav-icon";renderCategoryIcon(i,c.icon||"•");const n=document.createElement("span");n.className="nav-name";n.textContent=c.name;
    const count=document.createElement("span");count.className="nav-count";count.textContent=categoryCount(c.name);b.append(i,n,count);box.append(b)});
  $$(".nav-btn").forEach(btn=>btn.onclick=()=>{
    state.filter=btn.dataset.filter;
    state.query="";
    $("#searchInput").value="";
    $("#clearSearch").classList.remove("show");
    document.body.classList.remove("searching");
    syncNavActive();
    render();
    $("#sidebar").classList.remove("show");
    window.scrollTo({top:0,behavior:"smooth"});
  });
  syncNavActive();
}
function buildCategorySelect(){const sel=$("#newCategory");sel.innerHTML="";CATEGORIES.forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;sel.append(o)})}
function openDrawer(){updateStorageUsage();$("#drawer").classList.add("show");$("#backdrop").classList.add("show");renderCustomList();renderDeletedList();buildMoveCategorySelect();buildMoveSiteOptions();refreshIconPreview()}
function closeDrawer(){$("#drawer").classList.remove("show");$("#backdrop").classList.remove("show")}
function refreshIconPreview(){
  const box=$("#iconPreview");box.innerHTML="";const name=$("#newName").value.trim()||"新",url=$("#newUrl").value.trim(),iconUrl=$("#newIconUrl").value.trim();
  box.append(createSiteIcon({name,url,domain:safeDomain(url),icon:state.pendingIconData||"",iconUrl},"custom-mini-icon"));
}
function renderCustomList(){
  const box=$("#customList");
  box.innerHTML="";
  const visibleCustom=state.custom.filter(site=>!state.hiddenSites.has(site.id));
  $("#customCount").textContent=visibleCustom.length+" 个";
  if(!visibleCustom.length){const p=document.createElement("p");p.style.color="var(--muted)";p.style.fontSize="12px";p.textContent="还没有手动新增的网站。";box.append(p);return}
  visibleCustom.forEach(site=>{
    const row=document.createElement("div");row.className="custom-item";row.append(createSiteIcon(site,"custom-mini-icon"));
    const grow=document.createElement("div");grow.className="custom-grow";const b=document.createElement("b");b.textContent=site.name;const s=document.createElement("small");s.textContent=`${effectiveCategory(site)} · ${site.domain}`;grow.append(b,s);
    const actions=document.createElement("div");actions.className="custom-buttons";
    const edit=document.createElement("button");edit.className="mini-btn";edit.textContent="编辑";edit.onclick=async()=>{
      const name=await uiPromptV1821("网站名称",site.name);if(name===null)return;const url=await uiPromptV1821("网址",site.url);if(url===null)return;const iconUrl=await uiPromptV1821("图标地址（可留空）",site.iconUrl||"");if(iconUrl===null)return;
      try{
        const u=validHttpUrl(url);if(!u)throw new Error("请输入有效的 http/https 网址");
        const safeIcon=iconUrl.trim()?validIconValue(iconUrl.trim()):"";
        if(iconUrl.trim()&&!safeIcon)throw new Error("图标地址只支持 http/https 图片地址");
        const duplicate=rawSites().find(x=>x.id!==site.id&&canonicalUrl(x.url)===canonicalUrl(u.href));
        if(duplicate)throw new Error(`这个网址已经存在：${duplicate.name}`);
        site.name=name.trim()||site.name;site.url=u.href;site.domain=u.hostname.replace(/^www\./,"");site.iconUrl=safeIcon;
        if(!save())return;
        render();renderCustomList();toast("已更新")
      }catch(err){alert(err?.message||"更新失败")}
    };
    const del=document.createElement("button");del.className="mini-btn danger";del.textContent="删除";del.onclick=async()=>{if(await uiConfirmV1821(`删除「${site.name}」？\n\n可在“已删除网站”中恢复。`)){state.hiddenSites.add(site.id);state.favorites.delete(site.id);state.recents=state.recents.filter(id=>id!==site.id);save();buildNav();render();renderCustomList();renderDeletedList();buildMoveSiteOptions()}};
    actions.append(edit,del);row.append(grow,actions);box.append(row)
  });
}

function buildMoveCategorySelect(){
  const sel=$("#moveCategorySelect");
  if(!sel)return;
  const current=sel.value;
  sel.innerHTML="";
  CATEGORIES.forEach(c=>{
    const o=document.createElement("option");
    o.value=c.name;
    o.textContent=c.name;
    sel.append(o);
  });
  if(current&&CATEGORIES.some(c=>c.name===current))sel.value=current;
}
function buildMoveSiteOptions(){
  const sel=$("#moveSiteSelect");
  if(!sel)return;
  const old=sel.value;
  const q=($("#moveSearch")?.value||"").trim().toLowerCase();
  const list=allSites()
    .filter(site=>{
      if(!q)return true;
      return (`${site.name} ${site.domain} ${effectiveCategory(site)}`).toLowerCase().includes(q);
    })
    .sort((a,b)=>{
      const ca=effectiveCategory(a),cb=effectiveCategory(b);
      return ca.localeCompare(cb,"zh-CN")||a.name.localeCompare(b.name,"zh-CN");
    });

  sel.innerHTML="";
  list.forEach(site=>{
    const o=document.createElement("option");
    o.value=site.id;
    o.textContent=`${site.name} · ${site.domain} 【${effectiveCategory(site)}】`;
    sel.append(o);
  });

  if(old&&list.some(site=>site.id===old))sel.value=old;
  if(!sel.value&&list.length)sel.value=list[0].id;

  const selected=getMoveSite();
  if(selected&&$("#moveCategorySelect"))$("#moveCategorySelect").value=effectiveCategory(selected);
  updateMovePreview();
}
function getMoveSite(){
  const id=$("#moveSiteSelect")?.value;
  return allSites().find(site=>site.id===id)||null;
}
function updateMovePreview(){
  const box=$("#movePreview");
  if(!box)return;
  const site=getMoveSite();

  if(!site){
    box.innerHTML="没有匹配的网站";
    return;
  }

  const current=effectiveCategory(site);
  const target=$("#moveCategorySelect")?.value||current;
  box.innerHTML="";

  const line=document.createElement("div");
  line.className="move-line";

  const name=document.createElement("strong");
  name.textContent=site.name;

  const from=document.createElement("span");
  from.textContent=current;

  const arrow=document.createElement("span");
  arrow.className="move-arrow";
  arrow.textContent="→";

  const to=document.createElement("strong");
  to.textContent=target;

  line.append(name,from,arrow,to);
  box.append(line);

  const note=document.createElement("div");
  note.className="move-note";
  note.textContent=state.categoryOverrides[site.id]
    ? `默认分类：${site.category} · 当前已手动调整`
    : `默认分类：${site.category}`;
  box.append(note);
}
function moveSelectedCategory(){
  const site=getMoveSite();
  if(!site)return toast("请先选择网站");
  const target=$("#moveCategorySelect").value;

  if(target===site.category)delete state.categoryOverrides[site.id];
  else state.categoryOverrides[site.id]=target;

  save();
  buildNav();
  render();
  buildMoveSiteOptions();
  renderCustomList();
  toast(`「${site.name}」已移动到「${target}」`);
}
function restoreSelectedCategory(){
  const site=getMoveSite();
  if(!site)return toast("请先选择网站");

  if(state.categoryOverrides[site.id]){
    delete state.categoryOverrides[site.id];
    save();
    buildNav();
    render();
    buildMoveSiteOptions();
    renderCustomList();
    toast(`已恢复到默认分类「${site.category}」`);
  }else{
    $("#moveCategorySelect").value=site.category;
    updateMovePreview();
    toast("当前已经是默认分类");
  }
}


/* ===================== V10 · 前台右键分类 ===================== */
let contextSiteId="";

function contextSite(){
  return allSites().find(site=>site.id===contextSiteId)||null;
}

function closeCategoryContext(){
  const menu=$("#categoryContext");
  if(!menu)return;
  menu.classList.remove("show");
  menu.setAttribute("aria-hidden","true");
  contextSiteId="";
}

function positionCategoryContext(menu,x,y){
  const gap=10;
  menu.style.left="0px";
  menu.style.top="0px";
  menu.classList.add("show");
  menu.style.visibility="hidden";

  const rect=menu.getBoundingClientRect();
  let left=x+6;
  let top=y+6;

  if(left+rect.width+gap>window.innerWidth)left=x-rect.width-6;
  if(top+rect.height+gap>window.innerHeight)top=y-rect.height-6;

  left=Math.max(gap,Math.min(left,window.innerWidth-rect.width-gap));
  top=Math.max(gap,Math.min(top,window.innerHeight-rect.height-gap));

  menu.style.left=Math.round(left)+"px";
  menu.style.top=Math.round(top)+"px";
  menu.style.visibility="";
}

function buildCategoryContext(site){
  const menu=$("#categoryContext");
  menu.innerHTML="";

  const head=document.createElement("div");
  head.className="context-head";

  const iconWrap=createContextHeadIconV187(site);

  const copy=document.createElement("div");
  copy.className="context-head-copy";
  const name=document.createElement("div");
  name.className="context-head-name";
  name.textContent=site.name;
  const cat=document.createElement("div");
  cat.className="context-head-category";
  cat.textContent=`当前分类：${contextCategoryLabelV187(effectiveCategory(site))}`;
  copy.append(name,cat);
  head.append(iconWrap,copy);

  const label=document.createElement("div");
  label.className="context-label";
  label.textContent="移动到分类";

  const grid=document.createElement("div");
  grid.className="context-grid";

  const current=effectiveCategory(site);
  CATEGORIES.forEach(c=>{
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="context-item"+(c.name===current?" current":"");
    btn.setAttribute("role","menuitem");

    const ci=document.createElement("span");
    ci.className="context-cat-icon";
    renderCategoryIcon(ci,c.icon||"•");

    const cn=document.createElement("span");
    cn.className="context-cat-name";
    cn.textContent=contextCategoryLabelV187(c.name);

    btn.append(ci,cn);

    if(c.name===current){
      const check=document.createElement("span");
      check.className="context-check";
      check.textContent="✓";
      btn.append(check);
    }

    btn.onclick=e=>{
      e.preventDefault();
      e.stopPropagation();
      applyContextCategory(site,c.name);
    };
    grid.append(btn);
  });

  const footer=document.createElement("div");
  footer.className="context-footer";

  const restore=document.createElement("button");
  restore.type="button";
  restore.className="context-restore";
  restore.textContent=`恢复默认：${contextCategoryLabelV187(site.category)}`;
  restore.hidden=!state.categoryOverrides[site.id];
  restore.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    restoreContextCategory(site);
  };

  const tip=document.createElement("span");
  tip.className="context-tip";
  tip.textContent="右键图标快速管理";
  footer.append(restore,tip);

  const tools=document.createElement("div");
  tools.className="context-tools";

  const iconBtn=document.createElement("button");
  iconBtn.type="button";
  iconBtn.className="context-tool";
  iconBtn.innerHTML='<span class="context-tool-icon">▧</span><span>自定义图标</span>';
  iconBtn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    chooseContextIcon(site);
  };

  const resetIcon=document.createElement("button");
  resetIcon.type="button";
  resetIcon.className="context-tool";
  resetIcon.hidden=!state.iconOverrides[site.id];
  if(resetIcon.hidden)iconBtn.classList.add("full");
  resetIcon.innerHTML='<span class="context-tool-icon">↺</span><span>恢复默认图标</span>';
  resetIcon.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    resetContextIcon(site);
  };

  const copyBtn=document.createElement("button");
  copyBtn.type="button";
  copyBtn.className="context-tool copy-url";
  copyBtn.innerHTML='<span class="context-tool-icon">⧉</span><span>复制网址</span>';
  copyBtn.onclick=async e=>{
    e.preventDefault();e.stopPropagation();
    try{await navigator.clipboard.writeText(site.url);closeCategoryContext();toast("网址已复制")}
    catch{await uiPromptV1821("复制网址",site.url)}
  };

  const deleteBtn=document.createElement("button");
  deleteBtn.type="button";
  deleteBtn.className="context-tool danger full";
  deleteBtn.innerHTML='<span class="context-tool-icon">×</span><span>删除网站</span>';
  deleteBtn.onclick=e=>{
    e.preventDefault();
    e.stopPropagation();
    deleteContextSite(site);
  };

  tools.append(iconBtn,resetIcon,copyBtn,deleteBtn);
  menu.append(head,label,grid,footer,tools);
}

function openCategoryContext(e,site){
  try{
    contextSiteId=site.id;
    const menu=$("#categoryContext");
    buildCategoryContext(site);
    menu.setAttribute("aria-hidden","false");
    positionCategoryContext(menu,Number(e?.clientX)||24,Number(e?.clientY)||24);
  }catch(err){
    console.error("V18.7 context menu error",err);
    closeCategoryContext();
    toast("右键菜单加载失败，请刷新页面后重试");
  }
}

function applyContextCategory(site,target){
  const from=effectiveCategory(site);

  if(target===site.category)delete state.categoryOverrides[site.id];
  else state.categoryOverrides[site.id]=target;

  save();
  closeCategoryContext();
  buildNav();
  render();
  renderCustomList();

  if($("#moveSiteSelect")){
    buildMoveSiteOptions();
    const selected=getMoveSite();
    if(selected&&$("#moveCategorySelect"))$("#moveCategorySelect").value=effectiveCategory(selected);
    updateMovePreview();
  }

  if(from===target)toast(`「${site.name}」已经在「${target}」`);
  else toast(`「${site.name}」：${from} → ${target}`);
}

function restoreContextCategory(site){
  if(state.categoryOverrides[site.id])delete state.categoryOverrides[site.id];

  save();
  closeCategoryContext();
  buildNav();
  render();
  renderCustomList();

  if($("#moveSiteSelect")){
    buildMoveSiteOptions();
    updateMovePreview();
  }

  toast(`「${site.name}」已恢复到「${site.category}」`);
}


let pendingContextIconSiteId="";

function chooseContextIcon(site){
  pendingContextIconSiteId=site.id;
  closeCategoryContext();
  const input=$("#contextIconFile");
  input.value="";
  input.click();
}

function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error("读取图标失败"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataURL(dataUrl){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error("图标格式无法识别"));
    img.src=dataUrl;
  });
}

async function optimizeIconFile(file){
  if(!file)throw new Error("没有选择文件");
  if(file.size>12*1024*1024)throw new Error("图标文件不能超过 12MB");
  const allowed=new Set(["image/png","image/jpeg","image/webp","image/gif","image/x-icon","image/vnd.microsoft.icon"]);
  const extOk=/\.ico$/i.test(file.name||"");
  if(file.type&&!allowed.has(file.type)&&!extOk)throw new Error("仅支持 PNG / JPG / WebP / GIF / ICO，不接受 SVG");

  const original=await readFileAsDataURL(file);
  const img=await loadImageFromDataURL(original);
  const nw=Number(img.naturalWidth)||0,nh=Number(img.naturalHeight)||0;
  if(!nw||!nh)throw new Error("图标尺寸无法识别");
  if(nw*nh>60000000)throw new Error("图片像素过大，请先压缩后再上传");

  // 1) 用较小分析画布自动裁掉透明留白，让 Logo 主体尽量占满画布。
  const analysisMax=1024;
  const aScale=Math.min(1,analysisMax/Math.max(nw,nh));
  const aw=Math.max(1,Math.round(nw*aScale));
  const ah=Math.max(1,Math.round(nh*aScale));
  const ac=document.createElement("canvas");ac.width=aw;ac.height=ah;
  const actx=ac.getContext("2d",{willReadFrequently:true});
  actx.clearRect(0,0,aw,ah);
  actx.imageSmoothingEnabled=true;actx.imageSmoothingQuality="high";
  actx.drawImage(img,0,0,aw,ah);

  let sx=0,sy=0,sw=nw,sh=nh;
  try{
    const pixels=actx.getImageData(0,0,aw,ah).data;
    let minX=aw,minY=ah,maxX=-1,maxY=-1,transparentSeen=false;
    for(let y=0;y<ah;y++){
      for(let x=0;x<aw;x++){
        const a=pixels[(y*aw+x)*4+3];
        if(a<250)transparentSeen=true;
        if(a>14){
          if(x<minX)minX=x;if(x>maxX)maxX=x;
          if(y<minY)minY=y;if(y>maxY)maxY=y;
        }
      }
    }
    if(transparentSeen&&maxX>=minX&&maxY>=minY){
      const margin=Math.max(2,Math.round(Math.max(maxX-minX+1,maxY-minY+1)*.035));
      minX=Math.max(0,minX-margin);minY=Math.max(0,minY-margin);
      maxX=Math.min(aw-1,maxX+margin);maxY=Math.min(ah-1,maxY+margin);
      sx=Math.max(0,Math.floor(minX/aScale));
      sy=Math.max(0,Math.floor(minY/aScale));
      sw=Math.min(nw-sx,Math.ceil((maxX-minX+1)/aScale));
      sh=Math.min(nh-sy,Math.ceil((maxY-minY+1)/aScale));
    }
  }catch{}

  // 2) 先把超大图分阶段缩小，减少一次性超采样造成的发糊。
  const OUT=512;
  const INNER=456; // 约 11% 总留白，兼顾圆角和视觉饱满度
  const firstScale=Math.min(1,2048/Math.max(sw,sh));
  let stageW=Math.max(1,Math.round(sw*firstScale));
  let stageH=Math.max(1,Math.round(sh*firstScale));
  let stage=document.createElement("canvas");stage.width=stageW;stage.height=stageH;
  let sctx=stage.getContext("2d");
  sctx.imageSmoothingEnabled=true;sctx.imageSmoothingQuality="high";
  sctx.drawImage(img,sx,sy,sw,sh,0,0,stageW,stageH);

  while(Math.max(stage.width,stage.height)>INNER*2.1){
    const nextW=Math.max(1,Math.round(stage.width*.5));
    const nextH=Math.max(1,Math.round(stage.height*.5));
    const next=document.createElement("canvas");next.width=nextW;next.height=nextH;
    const nctx=next.getContext("2d");
    nctx.imageSmoothingEnabled=true;nctx.imageSmoothingQuality="high";
    nctx.drawImage(stage,0,0,nextW,nextH);
    stage=next;
  }

  // 3) 输出统一 512×512 高清方形图标，并把图片内容裁成圆角。
  const canvas=document.createElement("canvas");canvas.width=OUT;canvas.height=OUT;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,OUT,OUT);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";

  const ratio=Math.min(INNER/stage.width,INNER/stage.height);
  const w=Math.max(1,Math.round(stage.width*ratio));
  const h=Math.max(1,Math.round(stage.height*ratio));
  const x=Math.round((OUT-w)/2),y=Math.round((OUT-h)/2);
  const radius=Math.max(18,Math.round(Math.min(w,h)*.19));

  ctx.save();
  ctx.beginPath();
  if(typeof ctx.roundRect==="function")ctx.roundRect(x,y,w,h,radius);
  else{
    const r=Math.min(radius,w/2,h/2);
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  }
  ctx.closePath();ctx.clip();
  ctx.drawImage(stage,0,0,stage.width,stage.height,x,y,w,h);
  ctx.restore();

  // 4) WebP 高质量输出。512px 足够覆盖 2x/3x 高 DPI 显示；通常远低于 KV 1MB 限制。
  let out=canvas.toDataURL("image/webp",.96);
  if(!out||!out.startsWith("data:image/webp"))out=canvas.toDataURL("image/png");
  const approxBytes=Math.ceil((out.length-(out.indexOf(',')+1))*3/4);
  if(approxBytes>950*1024){
    out=canvas.toDataURL("image/webp",.90);
  }
  return out;
}

async function applyContextIconFile(file){
  const siteId=pendingContextIconSiteId;
  pendingContextIconSiteId="";
  const site=rawSites().find(x=>x.id===siteId);
  if(!site)return;
  try{
    const data=await optimizeIconFile(file);
    await uploadDataUrlIconV17(site.id,data);
    await refreshV17FromServer({quiet:true});
    closeCategoryContext();
    toast(`「${site.name}」图标已上传到 KV`);
  }catch(err){
    alert(err?.message||"图标上传失败");
  }
}

async function resetContextIcon(site){
  try{
    await v17Request("reset-icon","POST",null,{site:site.id});
    await refreshV17FromServer({quiet:true});
    closeCategoryContext();
    toast(`「${site.name}」已恢复自动高清图标`);
  }catch(err){alert(err?.message||"恢复图标失败")}
}

async function deleteContextSite(site){
  closeCategoryContext();
  if(!await uiConfirmV1821(`删除「${site.name}」？\n\n删除后会从导航中隐藏，可在“管理导航 → 已删除网站”里恢复。`))return;

  state.hiddenSites.add(site.id);
  state.favorites.delete(site.id);
  state.recents=state.recents.filter(id=>id!==site.id);

  save();
  buildNav();
  render();
  renderCustomList();
  renderDeletedList();
  buildMoveSiteOptions();
  toast(`已删除「${site.name}」`);
}

function restoreDeletedSite(siteId){
  const site=rawSites().find(x=>x.id===siteId);
  if(!site)return;

  state.hiddenSites.delete(siteId);
  save();
  buildNav();
  render();
  renderCustomList();
  renderDeletedList();
  buildMoveSiteOptions();
  toast(`已恢复「${site.name}」`);
}

function renderDeletedList(){
  const box=$("#deletedList");
  const count=$("#deletedCount");
  if(!box||!count)return;

  const deleted=rawSites().filter(site=>state.hiddenSites.has(site.id));
  count.textContent=deleted.length+" 个";
  box.innerHTML="";

  if(!deleted.length){
    const p=document.createElement("p");
    p.style.color="var(--muted)";
    p.style.fontSize="12px";
    p.textContent="没有已删除的网站。";
    box.append(p);
    return;
  }

  deleted.forEach(site=>{
    const row=document.createElement("div");
    row.className="deleted-item";

    row.append(createSiteIcon(site,"custom-mini-icon"));

    const copy=document.createElement("div");
    copy.className="deleted-copy";
    const name=document.createElement("b");
    name.textContent=site.name;
    const meta=document.createElement("small");
    meta.textContent=`${effectiveCategory(site)} · ${site.domain||safeDomain(site.url)}`;
    copy.append(name,meta);

    const restore=document.createElement("button");
    restore.type="button";
    restore.className="restore-site-btn";
    restore.textContent="恢复";
    restore.onclick=()=>restoreDeletedSite(site.id);

    row.append(copy,restore);
    box.append(row);
  });
}


function syncNavActive(){
  $$(".nav-btn").forEach(btn=>{
    btn.classList.toggle("active",btn.dataset.filter===state.filter);
  });
}

function applyTheme(){
  const saved=STORE.get(KEYS.theme);
  const allowed=new Set(["dark","light","liquid","neon","frosted"]);
  const fallback=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";
  const bootTheme=window.__FXNAV_BOOT_THEME__;
  const theme=allowed.has(saved)?saved:(allowed.has(bootTheme)?bootTheme:fallback);
  if(document.documentElement.dataset.theme!==theme)document.documentElement.dataset.theme=theme;
  updateThemeButton();
}
function themeSvgV1825(theme){
  const common='class="theme-svg-v1825" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  if(theme==="light")return `<svg ${common}><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="1.9"/><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2.4v2.2M12 19.4v2.2M4.93 4.93l1.55 1.55M17.52 17.52l1.55 1.55M2.4 12h2.2M19.4 12h2.2M4.93 19.08l1.55-1.55M17.52 6.48l1.55-1.55"/></g></svg>`;
  if(theme==="liquid")return `<svg ${common}><path d="M12 4a8 8 0 0 0 0 16Z" fill="#8e99aa"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="#ffffff"/><circle cx="12" cy="12" r="8" fill="none" stroke="#8290a5" stroke-width="1.15" opacity=".86"/></svg>`;
  if(theme==="frosted")return `<svg ${common}><rect x="4" y="6" width="11" height="11" rx="3" fill="currentColor" opacity=".42"/><rect x="9" y="4" width="11" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10.2 8.2h6.2M10.2 11h4.7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity=".72"/></svg>`;
  if(theme==="neon")return `<svg ${common}><path d="M12 3.1 14.15 9.85 20.9 12l-6.75 2.15L12 20.9l-2.15-6.75L3.1 12l6.75-2.15L12 3.1Z" fill="currentColor"/><circle cx="18.2" cy="5.8" r="1.15" fill="currentColor" opacity=".58"/></svg>`;
  return `<svg ${common}><path d="M19.55 15.3A7.9 7.9 0 0 1 8.7 4.45 8.1 8.1 0 1 0 19.55 15.3Z" fill="currentColor"/></svg>`;
}
function updateThemeButton(){
  const theme=document.documentElement.dataset.theme||"dark";
  const map={
    dark:{name:"深色",color:"#09111f"},
    light:{name:"浅色",color:"#eef3ff"},
    liquid:{name:"液态玻璃",color:"#eef4ff"},
    neon:{name:"霓虹星球",color:"#020713"},
    frosted:{name:"磨砂半透",color:"#161719"}
  };
  const info=map[theme]||map.dark;
  const svg=themeSvgV1825(theme);
  const main=$("#themeBtn"),compact=$("#compactThemeBtn");
  [main,compact].forEach(btn=>{
    if(!btn)return;
    btn.innerHTML=svg;
    btn.title=`当前：${info.name}主题 · 点击切换`;
    btn.setAttribute("aria-label",`当前${info.name}主题，点击切换`);
    btn.dataset.themeIcon=theme;
  });
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=info.color;
}


/* ===================== V13 · 核心数据层 ===================== */
let editingSiteId="",editingCategoryIconName="",categoryIconEditorReturnFocus=null,draggedSiteId="",siteDropCommitted=false,draggedCategoryName="";
function builtinById(id){return BUILTIN_SITES.find(s=>s.id===id)||null}
function isBuiltinSite(id){return !!builtinById(id)}
const FA47_ICON_NAMES=new Set("500px address-book address-book-o address-card address-card-o adjust adn align-center align-justify align-left align-right amazon ambulance american-sign-language-interpreting anchor android angellist angle-double-down angle-double-left angle-double-right angle-double-up angle-down angle-left angle-right angle-up apple archive area-chart arrow-circle-down arrow-circle-left arrow-circle-o-down arrow-circle-o-left arrow-circle-o-right arrow-circle-o-up arrow-circle-right arrow-circle-up arrow-down arrow-left arrow-right arrow-up arrows arrows-alt arrows-h arrows-v asl-interpreting assistive-listening-systems asterisk at audio-description automobile backward balance-scale ban bandcamp bank bar-chart bar-chart-o barcode bars bath bathtub battery battery-0 battery-1 battery-2 battery-3 battery-4 battery-empty battery-full battery-half battery-quarter battery-three-quarters bed beer behance behance-square bell bell-o bell-slash bell-slash-o bicycle binoculars birthday-cake bitbucket bitbucket-square bitcoin black-tie blind bluetooth bluetooth-b bold bolt bomb book bookmark bookmark-o braille briefcase btc bug building building-o bullhorn bullseye bus buysellads cab calculator calendar calendar-check-o calendar-minus-o calendar-o calendar-plus-o calendar-times-o camera camera-retro car caret-down caret-left caret-right caret-square-o-down caret-square-o-left caret-square-o-right caret-square-o-up caret-up cart-arrow-down cart-plus cc cc-amex cc-diners-club cc-discover cc-jcb cc-mastercard cc-paypal cc-stripe cc-visa certificate chain chain-broken check check-circle check-circle-o check-square check-square-o chevron-circle-down chevron-circle-left chevron-circle-right chevron-circle-up chevron-down chevron-left chevron-right chevron-up child chrome circle circle-o circle-o-notch circle-thin clipboard clock-o clone close cloud cloud-download cloud-upload cny code code-fork codepen codiepie coffee cog cogs columns comment comment-o commenting commenting-o comments comments-o compass compress connectdevelop contao copy copyright creative-commons credit-card credit-card-alt crop crosshairs css3 cube cubes cut cutlery dashboard dashcube database deaf deafness dedent delicious desktop deviantart diamond digg dollar dot-circle-o download dribbble drivers-license drivers-license-o dropbox drupal edge edit eercast eject ellipsis-h ellipsis-v empire envelope envelope-o envelope-open envelope-open-o envelope-square envira eraser etsy eur euro exchange exclamation exclamation-circle exclamation-triangle expand expeditedssl external-link external-link-square eye eye-slash eyedropper fa facebook facebook-f facebook-official facebook-square fast-backward fast-forward fax feed female fighter-jet file file-archive-o file-audio-o file-code-o file-excel-o file-image-o file-movie-o file-o file-pdf-o file-photo-o file-picture-o file-powerpoint-o file-sound-o file-text file-text-o file-video-o file-word-o file-zip-o files-o film filter fire fire-extinguisher firefox first-order flag flag-checkered flag-o flash flask flickr floppy-o folder folder-o folder-open folder-open-o font font-awesome fonticons fort-awesome forumbee forward foursquare free-code-camp frown-o futbol-o gamepad gavel gbp ge gear gears genderless get-pocket gg gg-circle gift git git-square github github-alt github-square gitlab gittip glass glide glide-g globe google google-plus google-plus-circle google-plus-official google-plus-square google-wallet graduation-cap gratipay grav group h-square hacker-news hand-grab-o hand-lizard-o hand-o-down hand-o-left hand-o-right hand-o-up hand-paper-o hand-peace-o hand-pointer-o hand-rock-o hand-scissors-o hand-spock-o hand-stop-o handshake-o hard-of-hearing hashtag hdd-o header headphones heart heart-o heartbeat history home hospital-o hotel hourglass hourglass-1 hourglass-2 hourglass-3 hourglass-end hourglass-half hourglass-o hourglass-start houzz html5 i-cursor id-badge id-card id-card-o ils image imdb inbox indent industry info info-circle inr instagram institution internet-explorer intersex ioxhost italic joomla jpy jsfiddle key keyboard-o krw language laptop lastfm lastfm-square leaf leanpub legal lemon-o level-down level-up life-bouy life-buoy life-ring life-saver lightbulb-o line-chart link linkedin linkedin-square linode linux list list-alt list-ol list-ul location-arrow lock long-arrow-down long-arrow-left long-arrow-right long-arrow-up low-vision magic magnet mail-forward mail-reply mail-reply-all male map map-marker map-o map-pin map-signs mars mars-double mars-stroke mars-stroke-h mars-stroke-v maxcdn meanpath medium medkit meetup meh-o mercury microchip microphone microphone-slash minus minus-circle minus-square minus-square-o mixcloud mobile mobile-phone modx money moon-o mortar-board motorcycle mouse-pointer music navicon neuter newspaper-o object-group object-ungroup odnoklassniki odnoklassniki-square opencart openid opera optin-monster outdent pagelines paint-brush paper-plane paper-plane-o paperclip paragraph paste pause pause-circle pause-circle-o paw paypal pencil pencil-square pencil-square-o percent phone phone-square photo picture-o pie-chart pied-piper pied-piper-alt pied-piper-pp pinterest pinterest-p pinterest-square plane play play-circle play-circle-o plug plus plus-circle plus-square plus-square-o podcast power-off print product-hunt puzzle-piece qq qrcode question question-circle question-circle-o quora quote-left quote-right ra random ravelry rebel recycle reddit reddit-alien reddit-square refresh registered remove renren reorder repeat reply reply-all resistance retweet rmb road rocket rotate-left rotate-right rouble rss rss-square rub ruble rupee s15 safari save scissors scribd search search-minus search-plus sellsy send send-o server share share-alt share-alt-square share-square share-square-o shekel sheqel shield ship shirtsinbulk shopping-bag shopping-basket shopping-cart shower sign-in sign-language sign-out signal signing simplybuilt sitemap skyatlas skype slack sliders slideshare smile-o snapchat snapchat-ghost snapchat-square snowflake-o soccer-ball-o sort sort-alpha-asc sort-alpha-desc sort-amount-asc sort-amount-desc sort-asc sort-desc sort-down sort-numeric-asc sort-numeric-desc sort-up soundcloud space-shuttle spinner spoon spotify square square-o stack-exchange stack-overflow star star-half star-half-empty star-half-full star-half-o star-o steam steam-square step-backward step-forward stethoscope sticky-note sticky-note-o stop stop-circle stop-circle-o street-view strikethrough stumbleupon stumbleupon-circle subscript subway suitcase sun-o superpowers superscript support table tablet tachometer tag tags tasks taxi telegram television tencent-weibo terminal text-height text-width th th-large th-list themeisle thermometer thermometer-0 thermometer-1 thermometer-2 thermometer-3 thermometer-4 thermometer-empty thermometer-full thermometer-half thermometer-quarter thermometer-three-quarters thumb-tack thumbs-down thumbs-o-down thumbs-o-up thumbs-up ticket times times-circle times-circle-o times-rectangle times-rectangle-o tint toggle-down toggle-left toggle-off toggle-on toggle-right toggle-up trademark train transgender transgender-alt trash trash-o tree trello tripadvisor trophy truck try tty tumblr tumblr-square turkish-lira tv twitch twitter twitter-square umbrella underline undo universal-access university unlink unlock unlock-alt unsorted upload usb usd user user-circle user-circle-o user-md user-o user-plus user-secret user-times users vcard vcard-o venus venus-double venus-mars viacoin viadeo viadeo-square video-camera vimeo vimeo-square vine vk volume-control-phone volume-down volume-off volume-up warning wechat weibo weixin whatsapp wheelchair wheelchair-alt wifi wikipedia-w window-close window-close-o window-maximize window-minimize window-restore windows won wordpress wpbeginner wpexplorer wpforms wrench xing xing-square y-combinator y-combinator-square yahoo yc yc-square yelp yen yoast youtube youtube-play youtube-square".split(" "));
function parseCategoryFAIcon(value){
  const raw=String(value||"").trim().replace(/\s+/g," ");
  const m=raw.match(/^(?:(?:fa|fas|far|fab|fa-solid|fa-regular|fa-brands)\s+)?(fa-[a-z0-9-]+)(?:\s+fa-fw)?$/i);
  if(!m)return null;
  const requested=m[1].toLowerCase();
  const rendered=requested==="fa-robot"?"fa-android":requested;
  if(!FA47_ICON_NAMES.has(rendered.slice(3)))return {invalid:true,requested};
  return {value:"fa "+requested,className:"fa "+rendered};
}
function looksLikeCategoryFAIcon(value){const x=String(value||"").trim();return /^(?:(?:fa|fas|far|fab|fa-solid|fa-regular|fa-brands)\b|fa-[a-z0-9-]+\b)/i.test(x)}
function normalizeCategoryIconInput(value){
  const x=String(value||"").trim().replace(/\s+/g," ");
  if(!x)return {ok:true,value:"•"};
  const parsed=parseCategoryFAIcon(x);
  if(parsed&&!parsed.invalid)return {ok:true,value:parsed.value};
  if(looksLikeCategoryFAIcon(x))return {ok:false,error:"Font Awesome 图标代码无效。请使用已支持的代码，例如 fa fa-search、fa fa-code 或 fa fa-server。"};
  return {ok:true,value:Array.from(x).slice(0,4).join("")||"•"};
}
function cleanCategoryGlyph(v){const result=normalizeCategoryIconInput(v);return result.ok?result.value:"•"}
function renderCategoryIcon(target,value){
  if(!target)return;
  target.replaceChildren();
  const normalized=normalizeCategoryIconInput(value);
  if(!normalized.ok){target.textContent="•";return}
  const parsed=parseCategoryFAIcon(normalized.value);
  if(parsed&&!parsed.invalid){const glyph=document.createElement("i");glyph.className=parsed.className;glyph.setAttribute("aria-hidden","true");target.append(glyph);return}
  target.textContent=normalized.value||"•";
}
function updateNewCategoryGlyphPreview(){const preview=$("#newCategoryGlyphPreview");if(preview)renderCategoryIcon(preview,$("#newCategoryGlyph")?.value||"◆")}
const RECOMMENDED_CATEGORY_ICONS={
  "常用·搜索":"fa fa-search","AI 助手·聚合":"fa fa-magic","AI 图像·视频":"fa fa-picture-o",
  "设计·灵感":"fa fa-paint-brush","素材·字体·PPT":"fa fa-cubes","图片·文档工具":"fa fa-file-text-o",
  "工具·导航":"fa fa-compass","开发·技术":"fa fa-code","软件·系统":"fa fa-cog",
  "网络·测速·IP":"fa fa-tachometer","VPN·代理":"fa fa-shield","影音·直播":"fa fa-play-circle-o",
  "游戏·资源":"fa fa-gamepad","学习·知识":"fa fa-book","政务·法律":"fa fa-balance-scale",
  "电商·购物":"fa fa-shopping-cart","账号·订阅":"fa fa-id-card-o","生活·出行":"fa fa-paper-plane-o",
  "社交·社区":"fa fa-comments-o","文件·下载·传输":"fa fa-download","其他收藏":"fa fa-folder-open-o",
  "电商网站":"fa fa-shopping-bag","VPS服务器":"fa fa-server"
};
function recommendedCategoryIcon(name){
  if(RECOMMENDED_CATEGORY_ICONS[name])return RECOMMENDED_CATEGORY_ICONS[name];
  const key=String(name||"").replace(/[·・\-\s]/g,"").toLowerCase();
  const entry=Object.entries(RECOMMENDED_CATEGORY_ICONS).find(([label])=>label.replace(/[·・\-\s]/g,"").toLowerCase()===key);
  return entry?.[1]||"";
}
async function applyRecommendedCategoryIcons(){
  const changes=allCategories().map(cat=>({cat,icon:recommendedCategoryIcon(cat.name)})).filter(item=>item.icon);
  if(!changes.length){toast("没有找到可匹配的推荐分类");return}
  if(!await uiConfirmV1821(`将为 ${changes.length} 个匹配分类应用 Font Awesome 推荐图标。\n\n只修改分类图标，不会改动网站、分类名称、排序或主题。继续？`))return;
  for(const {cat,icon} of changes){
    if(cat.builtin)state.categoryIconOverrides[cat.name]=icon;
    else{const item=state.customCategories.find(x=>x.name===cat.name);if(item)item.icon=icon}
  }
  if(!save())return;
  refreshCategoryUI();
  toast(`已应用推荐图标 · ${changes.length} 个分类`);
}
function allCategories(){
  const base=CATEGORIES.map(c=>({name:c.name,icon:cleanCategoryGlyph(state.categoryIconOverrides?.[c.name]||c.icon),builtin:true}));
  const customs=(Array.isArray(state.customCategories)?state.customCategories:[]).map(c=>({name:String(c.name||"").trim(),icon:cleanCategoryGlyph(c.icon),builtin:false})).filter(c=>c.name);
  const map=new Map([...base,...customs].map(c=>[c.name,c])),ordered=[],used=new Set();
  for(const name of state.categoryOrder||[])if(map.has(name)&&!used.has(name)){ordered.push(map.get(name));used.add(name)}
  for(const c of map.values())if(!used.has(c.name))ordered.push(c);
  return ordered;
}
function categoryByName(name){return allCategories().find(c=>c.name===name)||null}
function defaultCategoryName(){return allCategories()[0]?.name||"常用入口"}
function applySiteEdit(site){
  const edit=state.siteEdits?.[site.id];if(!edit)return site;
  const u=validHttpUrl(edit.url)||validHttpUrl(site.url),name=String(edit.name||site.name).trim()||site.name;
  return {...site,name,url:u?u.href:site.url,domain:u?u.hostname.replace(/^www\./,""):site.domain,fullTitle:name,iconUrl:validIconValue(edit.iconUrl)||site.iconUrl||""};
}
function rawSites(){return [...BUILTIN_SITES.map(applySiteEdit),...state.custom]}
function allSites(){return rawSites().filter(site=>!state.hiddenSites.has(site.id))}
function effectiveCategory(site){const cat=state.categoryOverrides[site.id]||site.category;return categoryByName(cat)?cat:defaultCategoryName()}
function orderedSites(items,category){
  const order=Array.isArray(state.siteOrder?.[category])?state.siteOrder[category]:[];if(!order.length)return [...items];
  const rank=new Map(order.map((id,i)=>[id,i])),original=new Map(items.map((s,i)=>[s.id,i]));
  return [...items].sort((a,b)=>(rank.has(a.id)?rank.get(a.id):Number.MAX_SAFE_INTEGER)-(rank.has(b.id)?rank.get(b.id):Number.MAX_SAFE_INTEGER)||(original.get(a.id)-original.get(b.id)));
}
function saveLocalState(){
  const entries=[
    [KEYS.favorites,JSON.stringify([...state.favorites])],
    [KEYS.recents,JSON.stringify(state.recents.slice(0,30))],
    [KEYS.custom,JSON.stringify(state.custom)],
    [KEYS.categoryOverrides,JSON.stringify(state.categoryOverrides)],
    [KEYS.iconOverrides,JSON.stringify(state.iconOverrides)],
    [KEYS.hiddenSites,JSON.stringify([...state.hiddenSites])],
    [KEYS.siteEdits,JSON.stringify(state.siteEdits)],
    [KEYS.customCategories,JSON.stringify(state.customCategories)],
    [KEYS.categoryOrder,JSON.stringify(state.categoryOrder)],
    [KEYS.categoryIconOverrides,JSON.stringify(state.categoryIconOverrides)],
    [KEYS.siteOrder,JSON.stringify(state.siteOrder)]
  ];
  const previous=new Map(entries.map(([k])=>[k,STORE.get(k)]));
  try{
    for(const [k,v] of entries)if(!STORE.set(k,v))throw new Error("storage");
    if($("#drawer")?.classList.contains("show"))updateStorageUsage();
    return true;
  }catch{
    for(const [k,v] of previous){if(v===null)STORE.remove(k);else STORE.set(k,v)}
    try{
      state.favorites=new Set(previous.get(KEYS.favorites)?JSON.parse(previous.get(KEYS.favorites)):[]);
      state.recents=previous.get(KEYS.recents)?JSON.parse(previous.get(KEYS.recents)):[];
      state.custom=previous.get(KEYS.custom)?JSON.parse(previous.get(KEYS.custom)):[];
      state.categoryOverrides=previous.get(KEYS.categoryOverrides)?JSON.parse(previous.get(KEYS.categoryOverrides)):{};
      state.iconOverrides=previous.get(KEYS.iconOverrides)?JSON.parse(previous.get(KEYS.iconOverrides)):{};
      state.hiddenSites=new Set(previous.get(KEYS.hiddenSites)?JSON.parse(previous.get(KEYS.hiddenSites)):[]);
      state.siteEdits=previous.get(KEYS.siteEdits)?JSON.parse(previous.get(KEYS.siteEdits)):{};
      state.customCategories=previous.get(KEYS.customCategories)?JSON.parse(previous.get(KEYS.customCategories)):[];
      state.categoryOrder=previous.get(KEYS.categoryOrder)?JSON.parse(previous.get(KEYS.categoryOrder)):[];
      state.categoryIconOverrides=previous.get(KEYS.categoryIconOverrides)?JSON.parse(previous.get(KEYS.categoryIconOverrides)):{};
      state.siteOrder=previous.get(KEYS.siteOrder)?JSON.parse(previous.get(KEYS.siteOrder)):{};
    }catch{}
    toast("本地存储空间不足，修改未保存");
    updateStorageUsage();
    return false;
  }
}

function save(){
  const ok=saveLocalState();
  if(ok&&window.__fxCloudSchedulePush)window.__fxCloudSchedulePush();
  return ok;
}

/* ===================== V15 · 收藏夹数据迁移 =====================
   内置网站改用 URL 稳定 ID，避免旧版 b1/b2 顺序变化后把设置套到错误网站。
   保留：自建网站、自定义分类、收藏、隐藏状态、图标覆盖、网站编辑。
   重置：旧的内置分类覆盖与排序，以 V15 新功能分类为准。
*/
const V15_BUILTIN_DATA_KEY="fxnav_builtin_data_version";
const V15_BUILTIN_DATA_VERSION="v15-bookmarks-2026-08-26";
const V15_LEGACY_ID_MAP={"b1":"v15_3774fcd95d","b2":"v15_f18e241fb1","b3":"v15_2dd6c1a3b2","b4":"v15_f67f8b8080","b5":"v15_b0fca655af","b6":"v15_d7e222c8d7","b8":"v15_238458cd8f","b9":"v15_0c0ab0e03a","b10":"v15_10e8bfa906","b11":"v15_3bcdb123da","b12":"v15_21bc77b9ea","b13":"v15_6fffdc9514","b14":"v15_1f3fae9498","b15":"v15_3d988ff408","b16":"v15_60b1cdcef1","b17":"v15_ed62d3c574","b18":"v15_2619869e23","b19":"v15_0f9b62b493","b20":"v15_9cb57a1f09","b21":"v15_4a51fa3f11","b22":"v15_bb4a43c385","b23":"v15_713747d632","b24":"v15_c26d242b25","b25":"v15_20939f2d41","b26":"v15_509899db69","b27":"v15_e689ed2c54","b28":"v15_4ae7142729","b29":"v15_530a97d449","b30":"v15_08f2a9e632","b31":"v15_da0e0a3193","b32":"v15_f757615729","b34":"v15_af14d1cfa1","b35":"v15_95fc2f7f3d","b36":"v15_329962017f","b37":"v15_7265eb16ef","b38":"v15_9385d63047","b39":"v15_2205c7e299","b41":"v15_28e1659c3b","b42":"v15_779b355126","b43":"v15_bc6bc35614","b44":"v15_647b034aa9","b46":"v15_ac56019f94","b47":"v15_d929c46f04","b48":"v15_67c0520269","b49":"v15_73ab9fa620","b51":"v15_1ac486f0d1","b52":"v15_622e75235e","b53":"v15_f8a43cb3a8","b54":"v15_5fb0124fd2","b55":"v15_a33e97d31f","b56":"v15_f606b77bcc","b59":"v15_4c96d01c16","b60":"v15_caa29d4fc1","b61":"v15_a2e550e549","b62":"v15_4db15fb229","b63":"v15_cfab7b7206","b64":"v15_93a2e32586","b65":"v15_8d0a428770","b66":"v15_4fdea5d0c2","b67":"v15_a5f8287fde","b72":"v15_8fc49afa83","b73":"v15_fcef32e911","b74":"v15_2745d121a5","b76":"v15_f2c4f6d4ff","b77":"v15_621c91e6c5","b78":"v15_6ea6b77c10","b79":"v15_e85141fda5","b84":"v15_fdf0193c8c","b90":"v15_d79f0b2134","b91":"v15_c541a4da7d","b92":"v15_302cf5a0b5","b93":"v15_c41f65e75c","b94":"v15_65b5584857","b96":"v15_5ebdf48193","b98":"v15_6808fa0476","b99":"v15_fb73689031","b101":"v15_340ba8bdaa","b102":"v15_65d8645bd9","b103":"v15_475f4aed0d","b105":"v15_6dadb1402f","b106":"v15_5d03533175","b107":"v15_24917e5f58","b108":"v15_a5199ca6fe","b109":"v15_8be0f3b38d","b110":"v15_a0da279638","b113":"v15_f0ecad78b1","b114":"v15_56aa5e91f7","b115":"v15_ac5c08a100","b117":"v15_797251ce7a","b119":"v15_620aa5d881","b120":"v15_bb69d8140d","b121":"v15_901014290f","b123":"v15_c5b5ba2df9","b129":"v15_8fcce288ea","b130":"v15_7075ec69da","b134":"v15_b926e79cea","b136":"v15_4efe95e1d8","b137":"v15_71bef59ede","b138":"v15_e14f7688ce","b139":"v15_b1ee3c4f16","b140":"v15_b3013b828e","b141":"v15_759644f6a5","b143":"v15_966a8a5165","b145":"v15_b257ffc7a9","b146":"v15_d981b88c86","b148":"v15_7ae4d65063","b150":"v15_7e4c04c55f","b151":"v15_ce4e0910e7","b152":"v15_c1b13d7284","b153":"v15_52214a4180","b154":"v15_f4804ec64e","b155":"v15_4fa373a46d","b156":"v15_656c0cf3f7","b158":"v15_c2208abde9","b161":"v15_a9f6522433","b164":"v15_4f6b790193","b167":"v15_3bc99c6deb","b168":"v15_bcec880cef","b169":"v15_04c83ff90f","b170":"v15_60285ee8fb","b171":"v15_1d88769cff","b172":"v15_7baa80f041","b175":"v15_d9c56ac5e7","b177":"v15_656c0cf3f7","b178":"v15_c2208abde9","b180":"v15_1287e35cea","b181":"v15_553f2b1043","b182":"v15_2f0c3be05d","b183":"v15_986427b30f","b184":"v15_4bd7fe2b81","b185":"v15_8279327d58","b186":"v15_ce3683f17e","b187":"v15_cbcc187526","b189":"v15_a2fb03ef6b","b190":"v15_05941361d1","b191":"v15_6bad95e816","b192":"v15_06e77e4f94","b193":"v15_abe5ceef11","b199":"v15_594646b889","b201":"v15_c0d18064b7","b202":"v15_50cfe8bdc6","b203":"v15_fd0635f90f","b204":"v15_aada9fa07b","b205":"v15_3d8b59061a","b206":"v15_6e40e8550c","b7":"v15_71ac3b64ad","b33":"v15_3ae75c87e1","b45":"v15_643ca6899c","b50":"v15_9d3ab2a14e","b75":"v15_c71ffd1cc8","b80":"v15_ede0af24d5","b81":"v15_528cc2b5a4","b82":"v15_7552b88148","b83":"v15_25ac2f7686","b85":"v15_bfc9aed50c","b95":"v15_f91c13bb39","b104":"v15_5442fd47f9","b112":"v15_a146c38c86","b118":"v15_76e1b0df51","b144":"v15_b78a68a6c0","b165":"v15_16df80577d","b174":"v15_f31da3f8d1","b200":"v15_22ad9b523a"};

function migrateBuiltinDataV15(){
  if(STORE.get(V15_BUILTIN_DATA_KEY)===V15_BUILTIN_DATA_VERSION)return false;

  const mapId=id=>V15_LEGACY_ID_MAP[id]||id;
  const mapSet=set=>new Set([...set].map(mapId));
  const mapObject=obj=>{
    const out={};
    for(const [id,val] of Object.entries(obj||{}))out[mapId(id)]=val;
    return out;
  };

  state.favorites=mapSet(state.favorites);
  state.hiddenSites=mapSet(state.hiddenSites);
  state.recents=[...new Set((state.recents||[]).map(mapId))];
  state.iconOverrides=mapObject(state.iconOverrides);
  state.siteEdits=mapObject(state.siteEdits);

  // V15 要使用新的功能分类，因此不继承旧版内置分类移动和旧排序
  state.categoryOverrides={};
  state.categoryOrder=[];
  state.siteOrder={};
  return true;
}

function sanitizeState(){
  const baseCategoryNames=new Set(CATEGORIES.map(c=>c.name)),seenCustomCats=new Set();
  state.customCategories=(Array.isArray(state.customCategories)?state.customCategories:[]).map(c=>{const name=String(c?.name||"").trim().slice(0,24);if(!name||baseCategoryNames.has(name)||seenCustomCats.has(name))return null;seenCustomCats.add(name);return {name,icon:cleanCategoryGlyph(c.icon)}}).filter(Boolean);
  const categoryNames=new Set([...CATEGORIES.map(c=>c.name),...state.customCategories.map(c=>c.name)]);
  state.categoryIconOverrides=Object.fromEntries(Object.entries(state.categoryIconOverrides||{}).filter(([name])=>baseCategoryNames.has(name)).map(([name,icon])=>[name,cleanCategoryGlyph(icon)]));
  state.categoryOrder=[...new Set(Array.isArray(state.categoryOrder)?state.categoryOrder:[])].filter(n=>categoryNames.has(n));for(const name of categoryNames)if(!state.categoryOrder.includes(name))state.categoryOrder.push(name);
  const builtinIds=new Set(BUILTIN_SITES.map(s=>s.id)),cleanEdits={};
  for(const [id,edit] of Object.entries(state.siteEdits||{})){if(!builtinIds.has(id)||!edit||typeof edit!=="object")continue;const base=builtinById(id),u=validHttpUrl(edit.url||base.url),name=String(edit.name||base.name).trim().slice(0,80);if(!u||!name)continue;const iconUrl=validIconValue(edit.iconUrl);if(name!==base.name||canonicalUrl(u.href)!==canonicalUrl(base.url)||iconUrl)cleanEdits[id]={name,url:u.href,iconUrl}}
  state.siteEdits=cleanEdits;
  const used=new Set(builtinIds),cleanCustom=[];
  for(const item of Array.isArray(state.custom)?state.custom:[]){if(!item||typeof item!=="object")continue;const u=validHttpUrl(item.url),name=String(item.name||"").trim().slice(0,80);if(!u||!name)continue;let id=String(item.id||"");if(!id||used.has(id))id="c"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);used.add(id);const category=categoryNames.has(String(item.category||""))?String(item.category):defaultCategoryName();cleanCustom.push({...item,id,name,url:u.href,domain:u.hostname.replace(/^www\./,""),category,icon:validIconValue(item.icon),iconUrl:validIconValue(item.iconUrl)})}
  state.custom=cleanCustom;
  const ids=new Set([...builtinIds,...state.custom.map(s=>s.id)]);
  state.hiddenSites=new Set([...state.hiddenSites].filter(id=>ids.has(id)));state.favorites=new Set([...state.favorites].filter(id=>ids.has(id)&&!state.hiddenSites.has(id)));state.recents=[...new Set(state.recents)].filter(id=>ids.has(id)&&!state.hiddenSites.has(id)).slice(0,30);
  const baseById=new Map([...BUILTIN_SITES,...state.custom].map(s=>[s.id,s])),cleanCats={};
  for(const [id,cat] of Object.entries(state.categoryOverrides||{})){const base=baseById.get(id);if(base&&categoryNames.has(cat)&&cat!==base.category)cleanCats[id]=cat}
  state.categoryOverrides=cleanCats;
  const cleanIcons={};for(const [id,val] of Object.entries(state.iconOverrides||{})){if(ids.has(id)){const safe=validIconValue(val);if(safe)cleanIcons[id]=safe}}state.iconOverrides=cleanIcons;
  const cleanOrder={};for(const [cat,list] of Object.entries(state.siteOrder||{})){if(!categoryNames.has(cat)||!Array.isArray(list))continue;const clean=[...new Set(list)].filter(id=>ids.has(id));if(clean.length)cleanOrder[cat]=clean}state.siteOrder=cleanOrder;
  if(state.filter!=="all"&&state.filter!=="favorite"&&state.filter!=="recent"&&!categoryNames.has(state.filter))state.filter="all";
}
function categoryCount(name){return allSites().filter(site=>effectiveCategory(site)===name).length}
function movedCount(){return Object.keys(state.categoryOverrides).filter(id=>rawSites().some(s=>s.id===id)).length}


/* ===================== V15.3 UI Pro helpers ===================== */
function getUsageStatsV157(){
  const raw=parseStored("fxnav_usage_stats_v157",{});
  return raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
}
function getHeroRecentSites(){
  const pool=allSites().filter(site=>!state.hiddenSites.has(site.id));
  const usage=getUsageStatsV157();
  const recentRank=new Map(state.recents.map((id,i)=>[id,i]));
  const now=Date.now();

  return [...pool].sort((a,b)=>{
    const score=site=>{
      const u=usage[site.id]||{};
      const count=Math.max(0,Number(u.count)||0);
      const age=Math.max(0,now-(Number(u.last)||0));
      const freshness=u.last?Math.max(0,18-age/86400000):0;
      const recent=recentRank.has(site.id)?Math.max(0,28-recentRank.get(site.id)*1.6):0;
      const favorite=state.favorites.has(site.id)?16:0;
      return Math.log2(count+1)*9+freshness+recent+favorite;
    };
    return score(b)-score(a);
  }).slice(0,4);
}

function renderHeroRecent(){
  const box=$("#heroRecentList");if(!box)return;
  box.innerHTML="";
  const title=$("#heroRecentTitle"),more=$("#heroRecentMore");
  const hasRecent=state.recents.some(id=>rawSites().some(s=>s.id===id&&!state.hiddenSites.has(id)));
  const hasFavorite=[...state.favorites].some(id=>rawSites().some(s=>s.id===id&&!state.hiddenSites.has(id)));
  const mode=hasRecent?"recent":hasFavorite?"favorite":"quick";
  if(title)title.textContent=mode==="recent"?"最近使用":mode==="favorite"?"我的收藏":"快捷入口";
  if(more){more.dataset.mode=mode;more.textContent=mode==="quick"?"全部网站":"查看全部"}
  const sites=getHeroRecentSites();
  if(!sites.length){const empty=document.createElement("div");empty.className="hero-recent-empty";empty.textContent="访问过的网站会出现在这里";box.append(empty);return}
  sites.forEach(site=>{
    const btn=document.createElement("button");btn.type="button";btn.className="hero-quick";btn.title=site.name;
    btn.append(createSiteIcon(site,"custom-mini-icon"));
    const copy=document.createElement("span");copy.className="hero-quick-copy";
    const name=document.createElement("span");name.className="hero-quick-name";name.textContent=site.name;
    const domain=document.createElement("span");domain.className="hero-quick-domain";domain.textContent=site.domain||safeDomain(site.url);
    copy.append(name,domain);
    const arrow=document.createElement("span");arrow.className="hero-quick-arrow";arrow.textContent="↗";
    btn.append(copy,arrow);
    btn.onclick=()=>{recordRecent(site.id);window.open(site.url,"_blank","noopener")};
    box.append(btn);
  });
}

function updateNavIndicator(){
  const indicator=$("#navActiveIndicator"),active=(state.filter==="all"&&!state.query.trim()?$(".nav-btn.scroll-active")||$(".nav-btn.active"):$(".nav-btn.active")),sidebar=$("#sidebar");
  if(!indicator||!active||!sidebar)return;
  const y=active.offsetTop+(active.offsetHeight-36)/2;
  indicator.style.height="36px";
  indicator.style.transform=`translate3d(0,${Math.round(y)}px,0)`;
  indicator.classList.add("ready");
}

let __contentAnimRAF=0;
function animateContentIn(){
  const content=$("#content");if(!content)return;
  content.classList.remove("view-transition-in");
  cancelAnimationFrame(__contentAnimRAF);
  __contentAnimRAF=requestAnimationFrame(()=>content.classList.add("view-transition-in"));
}

function setSearchQuery(value,{focus=false,animate=false}={}){
  state.query=String(value||"");
  const main=$("#searchInput"),compact=$("#compactSearchInput"),clear=$("#clearSearch");
  if(main&&main.value!==state.query)main.value=state.query;
  if(compact&&compact.value!==state.query)compact.value=state.query;
  clear?.classList.toggle("show",!!state.query);
  document.body.classList.toggle("searching",!!state.query.trim());
  render();
  if(animate)animateContentIn();
  if(focus){const target=$("#compactBar")?.classList.contains("show")?compact:main;target?.focus();target?.select()}
}

function syncCompactControls(){
  const count=$("#compactSiteCount");if(count)count.textContent=allSites().length;
  const sort=$("#compactSortBtn");if(sort){sort.classList.toggle("active",!!state.sortMode);sort.textContent=state.sortMode?"✓":"↕";sort.title=state.sortMode?"完成排序":"排序"}
  updateThemeButton();
}


/* ===================== V15.7 helpers ===================== */
let __sectionSpyObserver=null,__sectionSpyTimer=0;
function clearSectionSpy(){
  $$(".nav-btn.scroll-active").forEach(btn=>btn.classList.remove("scroll-active"));
  document.body.classList.remove("scroll-spy-active");
}
function setScrollSpyCategory(cat){
  if(state.filter!=="all"||state.query.trim())return clearSectionSpy();
  let matched=false;
  $$(".nav-btn").forEach(btn=>{
    const on=btn.dataset.filter===cat;
    btn.classList.toggle("scroll-active",on);
    if(on)matched=true;
  });
  document.body.classList.toggle("scroll-spy-active",matched);
  if(matched)requestAnimationFrame(updateNavIndicator);
}
function initSectionSpy(){
  if(__sectionSpyObserver){__sectionSpyObserver.disconnect();__sectionSpyObserver=null}
  clearSectionSpy();
  if(state.filter!=="all"||state.query.trim())return;
  const sections=$$("#content .section[data-category]").filter(s=>s.dataset.category);
  if(!sections.length)return;

  __sectionSpyObserver=new IntersectionObserver(entries=>{
    const candidates=entries.filter(e=>e.isIntersecting&&e.target.dataset.category);
    if(!candidates.length)return;
    candidates.sort((a,b)=>Math.abs(a.boundingClientRect.top-105)-Math.abs(b.boundingClientRect.top-105));
    setScrollSpyCategory(candidates[0].target.dataset.category);
  },{root:null,rootMargin:"-86px 0px -62% 0px",threshold:[0,.01]});
  sections.forEach(sec=>__sectionSpyObserver.observe(sec));
}
function scheduleSectionSpy(){
  clearTimeout(__sectionSpyTimer);
  __sectionSpyTimer=setTimeout(initSectionSpy,30);
}

const V157_DENSITY_KEY="fxnav_density_v157";
function applyDensityV157(){
  const compact=STORE.get(V157_DENSITY_KEY)==="compact";
  document.body.classList.toggle("density-compact",compact);
  const btn=$("#densityBtn");
  if(btn)btn.innerHTML=compact?'<span class="tool-glyph">▤</span><span>舒适</span>':'<span class="tool-glyph">▦</span><span>紧凑</span>';
  const compactBtn=$("#compactDensityBtn");
  if(compactBtn){compactBtn.textContent=compact?"▤":"▦";compactBtn.title=compact?"切换舒适布局":"切换紧凑布局"}
}
function toggleDensityV157(){
  const compact=!document.body.classList.contains("density-compact");
  STORE.set(V157_DENSITY_KEY,compact?"compact":"comfortable");
  applyDensityV157();
  toast(compact?"已切换紧凑布局":"已切换舒适布局");
}

function syncMobileBottomBar(){
  const fav=$("#mobileFavoriteBtn"),home=$("#mobileHomeBtn");
  if(fav)fav.classList.toggle("active",state.filter==="favorite");
  if(home)home.classList.toggle("active",state.filter!=="favorite");
}

/* V13/V15.7 view */
function categoryDescription(cat){
  const map={
    "常用·搜索":"搜索入口与每天最常打开的基础工具",
    "AI 助手·聚合":"AI 对话、模型聚合与智能助理",
    "AI 图像·视频":"AI 绘图、视频生成与视觉创作",
    "设计·灵感":"设计平台、视觉参考与创意灵感",
    "素材·字体·PPT":"图片素材、字体、模板与演示资源",
    "图片·文档工具":"图片处理、格式转换与文档效率工具",
    "工具·导航":"在线工具集合、网址导航与效率入口",
    "开发·技术":"代码托管、开发工具与技术资源",
    "软件·系统":"软件下载、系统工具与桌面应用",
    "网络·测速·IP":"IP 检测、网络质量、测速与诊断",
    "VPN·代理":"代理工具、节点检测与网络辅助",
    "影音·直播":"视频、影视、直播与音乐内容",
    "游戏·资源":"游戏相关资源与实用工具",
    "学习·知识":"知识平台、课程、资料与学习工具",
    "政务·法律":"政务服务、法律查询与公共信息",
    "电商·购物":"购物平台、商品服务与电商工具",
    "账号·订阅":"账号管理、订阅服务与价格信息",
    "生活·出行":"地图、物流、汽车与生活服务",
    "社交·社区":"社交平台、社区与内容交流",
    "文件·下载·传输":"文件传输、临时网盘与下载工具",
    "搜索结果":"按名称、域名、标题与分类匹配",
    "我的收藏":"你手动收藏的常用网站",
    "最近访问":"按最近打开顺序排列"
  };
  return map[cat]||"自定义收藏分类";
}
function sectionBlock(cat,items,icon){
  const isRealCategory=!!categoryByName(cat),sorted=isRealCategory?orderedSites(items,cat):items;
  const sec=document.createElement("section");sec.className="section";sec.dataset.category=isRealCategory?cat:"";

  const head=document.createElement("div");head.className="section-head";
  const title=document.createElement("div");title.className="section-title";
  const badge=document.createElement("span");badge.className="section-badge";renderCategoryIcon(badge,icon||"•");

  const copy=document.createElement("div");copy.className="section-heading-copy";
  const line=document.createElement("div");line.className="section-heading-line";
  const h=document.createElement("h2");h.textContent=cat;
  const total=document.createElement("span");total.className="section-total";total.textContent=`${sorted.length} 个`;
  line.append(h,total);
  const desc=document.createElement("div");desc.className="section-desc";desc.textContent=categoryDescription(cat);
  copy.append(line,desc);
  title.append(badge,copy);head.append(title);sec.append(head);

  const grid=document.createElement("div");grid.className="grid";grid.dataset.category=isRealCategory?cat:"";
  sorted.forEach(site=>{
    const card=createCard(site);card.dataset.siteId=site.id;
    if(isRealCategory&&state.sortMode){
      card.draggable=true;
      const handle=document.createElement("span");handle.className="sort-handle";handle.textContent="⋮⋮";handle.title="拖拽排序";
      card.append(handle);bindSiteDrag(card,grid,site)
    }
    grid.append(card)
  });
  if(isRealCategory&&state.sortMode)bindGridDrop(grid,cat);
  sec.append(grid);
  return sec;
}
function render(opts={}){
  const content=$("#content");content.innerHTML="";const visible=filteredSites();
  if(state.query.trim())content.append(visible.length?sectionBlock("搜索结果",visible,"⌕"):emptyBlock("没有找到匹配的网站"));
  else if(state.filter==="favorite")content.append(visible.length?sectionBlock("我的收藏",visible,"★"):emptyBlock("还没有收藏网站"));
  else if(state.filter==="recent")content.append(visible.length?sectionBlock("最近访问",visible,"↺"):emptyBlock("还没有最近访问记录"));
  else if(state.filter!=="all"){const c=categoryByName(state.filter);content.append(visible.length?sectionBlock(state.filter,visible,c?.icon||"•"):emptyBlock("这个分类还没有网站"))}
  else allCategories().forEach(c=>{const g=visible.filter(s=>effectiveCategory(s)===c.name);if(g.length)content.append(sectionBlock(c.name,g,c.icon))});
  document.body.classList.toggle("sort-mode",!!state.sortMode);const sortBtn=$("#sortModeBtn");if(sortBtn){sortBtn.classList.toggle("active",!!state.sortMode);sortBtn.innerHTML=state.sortMode?'<span class="tool-glyph">✓</span><span>完成排序</span>':'<span class="tool-glyph">↕</span><span>排序</span>'}updateCounts();renderHeroRecent();syncCompactControls();scheduleSectionSpy();syncMobileBottomBar();if(opts.animate)animateContentIn();
}
function buildNav(){
  const box=$("#categoryNav");box.innerHTML="";
  allCategories().forEach(c=>{const b=document.createElement("button");b.className="nav-btn";b.dataset.filter=c.name;const i=document.createElement("span");i.className="nav-icon";renderCategoryIcon(i,c.icon||"•");const n=document.createElement("span");n.className="nav-name";n.textContent=c.name;const count=document.createElement("span");count.className="nav-count";count.textContent=categoryCount(c.name);b.append(i,n,count);box.append(b)});
  $$(".nav-btn").forEach(btn=>btn.onclick=()=>{state.filter=btn.dataset.filter;state.query="";$("#searchInput").value="";const compact=$("#compactSearchInput");if(compact)compact.value="";$("#clearSearch").classList.remove("show");document.body.classList.remove("searching");syncNavActive();render({animate:true});$("#sidebar").classList.remove("show");window.scrollTo({top:0,behavior:"smooth"});setTimeout(updateNavIndicator,20)});syncNavActive();requestAnimationFrame(updateNavIndicator);
}
function fillCategorySelect(sel,current=""){if(!sel)return;sel.innerHTML="";allCategories().forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;sel.append(o)});if(current&&categoryByName(current))sel.value=current}
function buildCategorySelect(){fillCategorySelect($("#newCategory"))}
function buildMoveCategorySelect(){const sel=$("#moveCategorySelect");if(!sel)return;fillCategorySelect(sel,sel.value)}
function openDrawer(){
  const drawer=$("#drawer"),backdrop=$("#backdrop");
  if(!drawer||!backdrop)return;
  drawer.classList.add("show");backdrop.classList.add("show");
  const modernManager=!!document.getElementById("managerTabs");
  if(modernManager){
    setTimeout(()=>{
      if(drawer.classList.contains("show")){updateStorageUsage();refreshIconPreview()}
    },260);
    return;
  }
  updateStorageUsage();renderCategoryManager();renderCustomList();renderDeletedList();
  buildCategorySelect();buildMoveCategorySelect();buildMoveSiteOptions();refreshIconPreview();
}

/* V13 editor */
function openSiteEditor(siteOrId){
  const site=typeof siteOrId==="string"?rawSites().find(s=>s.id===siteOrId):siteOrId;if(!site)return;closeCategoryContext();editingSiteId=site.id;
  $("#editSiteName").value=site.name||"";$("#editSiteUrl").value=site.url||"";$("#editSiteIconUrl").value=state.siteEdits?.[site.id]?.iconUrl||site.iconUrl||"";fillCategorySelect($("#editSiteCategory"),effectiveCategory(site));
  $("#siteEditorMeta").textContent=isBuiltinSite(site.id)?"内置收藏 · 修改会以覆盖配置保存":"我的新增 · 可直接修改";$("#restoreSiteInfoBtn").hidden=!isBuiltinSite(site.id)||!state.siteEdits[site.id];refreshSiteEditorPreview();
  $("#siteEditorBackdrop").classList.add("show");$("#siteEditorBackdrop").setAttribute("aria-hidden","false");setTimeout(()=>$("#editSiteName").focus(),20);
}
function closeSiteEditor(){editingSiteId="";$("#siteEditorBackdrop").classList.remove("show");$("#siteEditorBackdrop").setAttribute("aria-hidden","true")}
function refreshSiteEditorPreview(){const box=$("#editSitePreview");if(!box)return;box.innerHTML="";const name=$("#editSiteName").value.trim()||"新",url=$("#editSiteUrl").value.trim(),iconUrl=validIconValue($("#editSiteIconUrl").value.trim()),original=rawSites().find(s=>s.id===editingSiteId);box.append(createSiteIcon({id:editingSiteId||"preview",name,url,domain:safeDomain(url),icon:original?.icon||"",iconUrl},"custom-mini-icon"))}
function saveSiteEditor(){
  const current=rawSites().find(s=>s.id===editingSiteId);if(!current)return;
  const name=$("#editSiteName").value.trim(),u=validHttpUrl($("#editSiteUrl").value.trim()),iconRaw=$("#editSiteIconUrl").value.trim(),iconUrl=iconRaw?validIconValue(iconRaw):"",category=$("#editSiteCategory").value;
  if(!name)return alert("网站名称不能为空");if(!u)return alert("请输入有效的 http/https 网址");if(iconRaw&&!iconUrl)return alert("图标地址只支持 http/https 图片地址");if(!categoryByName(category))return alert("分类无效");
  const duplicate=rawSites().find(s=>s.id!==current.id&&canonicalUrl(s.url)===canonicalUrl(u.href));if(duplicate)return alert(`这个网址已经存在：${duplicate.name}`);
  if(isBuiltinSite(current.id)){const base=builtinById(current.id),edit={name:name.slice(0,80),url:u.href,iconUrl},unchanged=edit.name===base.name&&canonicalUrl(edit.url)===canonicalUrl(base.url)&&!edit.iconUrl;if(unchanged)delete state.siteEdits[current.id];else state.siteEdits[current.id]=edit;if(category===base.category)delete state.categoryOverrides[current.id];else state.categoryOverrides[current.id]=category}
  else{const target=state.custom.find(s=>s.id===current.id);if(!target)return;target.name=name.slice(0,80);target.url=u.href;target.domain=u.hostname.replace(/^www\./,"");target.fullTitle=target.name;target.iconUrl=iconUrl;if(category===target.category)delete state.categoryOverrides[target.id];else state.categoryOverrides[target.id]=category}
  if(!save())return;closeSiteEditor();buildNav();render();renderCustomList();buildMoveSiteOptions();renderDeletedList();toast("网站信息已更新");
}
function restoreSiteInfo(){if(!editingSiteId||!isBuiltinSite(editingSiteId))return;delete state.siteEdits[editingSiteId];if(!save())return;const id=editingSiteId,site=rawSites().find(s=>s.id===id);if(site)openSiteEditor(site);buildNav();render();renderDeletedList();toast("已恢复原始名称和网址")}
function renderCustomList(){
  const box=$("#customList");box.innerHTML="";const visibleCustom=state.custom.filter(site=>!state.hiddenSites.has(site.id));$("#customCount").textContent=visibleCustom.length+" 个";
  if(!visibleCustom.length){const p=document.createElement("p");p.style.color="var(--muted)";p.style.fontSize="12px";p.textContent="还没有手动新增的网站。";box.append(p);return}
  visibleCustom.forEach(baseSite=>{const site=rawSites().find(s=>s.id===baseSite.id)||baseSite,row=document.createElement("div");row.className="custom-item";row.append(createSiteIcon(site,"custom-mini-icon"));const grow=document.createElement("div");grow.className="custom-grow";const b=document.createElement("b");b.textContent=site.name;const sm=document.createElement("small");sm.textContent=`${effectiveCategory(site)} · ${site.domain||safeDomain(site.url)}`;grow.append(b,sm);const actions=document.createElement("div");actions.className="custom-buttons";const edit=document.createElement("button");edit.className="mini-btn";edit.textContent="编辑";edit.onclick=()=>openSiteEditor(site);const del=document.createElement("button");del.className="mini-btn danger";del.textContent="删除";del.onclick=async()=>{if(await uiConfirmV1821(`删除「${site.name}」？\\n\\n可在“已删除网站”中恢复。`)){state.hiddenSites.add(site.id);state.favorites.delete(site.id);state.recents=state.recents.filter(id=>id!==site.id);save();buildNav();render();renderCustomList();renderDeletedList();buildMoveSiteOptions()}};actions.append(edit,del);row.append(grow,actions);box.append(row)});
}

function updateCounts(){
  $("#allCount").textContent=allSites().length;
  $("#favCount").textContent=state.favorites.size;
  $("#recentCount").textContent=state.recents.length;
  $("#siteCount").textContent=allSites().length;
  $("#catCount").textContent=allCategories().length;
  $("#customCount").textContent=state.custom.filter(site=>!state.hiddenSites.has(site.id)).length+" 个";
  if($("#deletedCount"))$("#deletedCount").textContent=state.hiddenSites.size+" 个";
  if($("#movedCount"))$("#movedCount").textContent=movedCount()+" 个已调整";
  if($("#categoryManageCount"))$("#categoryManageCount").textContent=allCategories().length+" 个分类";
  if($("#compactSiteCount"))$("#compactSiteCount").textContent=allSites().length;
  updateNavCounts();
  requestAnimationFrame(updateNavIndicator);
}

/* V13 categories */
function renderCategoryManager(){
  const box=$("#categoryManagerList");if(!box)return;box.innerHTML="";const cats=allCategories();$("#categoryManageCount").textContent=cats.length+" 个分类";
  cats.forEach((cat,index)=>{const row=document.createElement("div");row.className="category-manager-item";row.draggable=true;row.dataset.category=cat.name;const drag=document.createElement("span");drag.className="category-drag";drag.textContent="⋮⋮";drag.title="拖拽调整分类顺序";const icon=document.createElement("span");icon.className="category-manager-icon";renderCategoryIcon(icon,cat.icon);const copy=document.createElement("div");copy.className="category-manager-copy";const b=document.createElement("b");b.textContent=cat.name;const sm=document.createElement("small");sm.textContent=`${cat.builtin?"内置分类":"自定义分类"} · ${categoryCount(cat.name)} 个网站`;copy.append(b,sm);const actions=document.createElement("div");actions.className="category-manager-actions";const up=document.createElement("button");up.className="cat-mini";up.textContent="↑";up.disabled=index===0;up.onclick=()=>moveCategoryStep(cat.name,-1);const down=document.createElement("button");down.className="cat-mini";down.textContent="↓";down.disabled=index===cats.length-1;down.onclick=()=>moveCategoryStep(cat.name,1);const iconBtn=document.createElement("button");iconBtn.className="cat-mini";iconBtn.textContent="图标";iconBtn.onclick=()=>editCategoryIcon(cat);actions.append(up,down,iconBtn);if(!cat.builtin){const rename=document.createElement("button");rename.className="cat-mini";rename.textContent="重命名";rename.onclick=()=>renameCustomCategory(cat.name);const del=document.createElement("button");del.className="cat-mini danger";del.textContent="删除";del.onclick=()=>deleteCustomCategory(cat.name);actions.append(rename,del)}row.append(drag,icon,copy,actions);bindCategoryDrag(row);box.append(row)});
}
function addCustomCategory(){const name=$("#newCategoryName").value.trim().slice(0,24),iconResult=normalizeCategoryIconInput($("#newCategoryGlyph").value);if(!name)return alert("请输入分类名称");if(categoryByName(name))return alert("这个分类已经存在");if(!iconResult.ok)return alert(iconResult.error);const icon=iconResult.value;state.customCategories.push({name,icon});state.categoryOrder.push(name);if(!save()){state.customCategories=state.customCategories.filter(c=>c.name!==name);state.categoryOrder=state.categoryOrder.filter(n=>n!==name);return}$("#newCategoryName").value="";$("#newCategoryGlyph").value="";updateNewCategoryGlyphPreview();refreshCategoryUI();toast(`已新增分类「${name}」`)}
function editCategoryIcon(cat){openCategoryIconEditor(cat)}
function openCategoryIconEditor(cat){
  if(!cat)return;
  editingCategoryIconName=cat.name;
  categoryIconEditorReturnFocus=document.activeElement;
  $("#categoryIconEditorTitle").textContent=`修改「${cat.name}」图标`;
  $("#categoryIconEditorInput").value=cat.icon||"•";
  updateCategoryIconEditorPreview();
  const backdrop=$("#categoryIconEditorBackdrop");backdrop.classList.add("show");backdrop.setAttribute("aria-hidden","false");
  setTimeout(()=>$("#categoryIconEditorInput")?.focus(),30);
}
function closeCategoryIconEditor(){
  const backdrop=$("#categoryIconEditorBackdrop");if(!backdrop)return;
  backdrop.classList.remove("show");backdrop.setAttribute("aria-hidden","true");
  editingCategoryIconName="";
  const target=categoryIconEditorReturnFocus;categoryIconEditorReturnFocus=null;
  if(target?.isConnected)setTimeout(()=>target.focus({preventScroll:true}),0);
}
function updateCategoryIconEditorPreview(){const preview=$("#categoryIconEditorPreview");if(preview)renderCategoryIcon(preview,$("#categoryIconEditorInput")?.value||"•")}
function saveCategoryIconEditor(){
  const cat=categoryByName(editingCategoryIconName);if(!cat){closeCategoryIconEditor();return}
  const result=normalizeCategoryIconInput($("#categoryIconEditorInput").value);
  if(!result.ok){alert(result.error);return}
  if(cat.builtin)state.categoryIconOverrides[cat.name]=result.value;
  else{const item=state.customCategories.find(c=>c.name===cat.name);if(item)item.icon=result.value}
  if(!save())return;
  closeCategoryIconEditor();refreshCategoryUI();toast("分类图标已更新");
}

async function renameCustomCategory(oldName){const item=state.customCategories.find(c=>c.name===oldName);if(!item)return;const input=await uiPromptV1821("新的分类名称",oldName);if(input===null)return;const next=String(input).trim().slice(0,24);if(!next||next===oldName)return;if(categoryByName(next))return alert("这个分类已经存在");item.name=next;state.categoryOrder=state.categoryOrder.map(n=>n===oldName?next:n);if(state.siteOrder[oldName]){state.siteOrder[next]=state.siteOrder[oldName];delete state.siteOrder[oldName]}state.custom.forEach(site=>{if(site.category===oldName)site.category=next});for(const id of Object.keys(state.categoryOverrides))if(state.categoryOverrides[id]===oldName)state.categoryOverrides[id]=next;if(state.filter===oldName)state.filter=next;if(!save())return;refreshCategoryUI();toast(`已重命名为「${next}」`)}
async function deleteCustomCategory(name){const count=rawSites().filter(site=>effectiveCategory(site)===name).length;if(count)return alert(`「${name}」还有 ${count} 个网站（包含已删除/隐藏的网站），请先把这些网站移动到其他分类。`);if(!await uiConfirmV1821(`删除分类「${name}」？`))return;state.customCategories=state.customCategories.filter(c=>c.name!==name);state.categoryOrder=state.categoryOrder.filter(n=>n!==name);delete state.siteOrder[name];if(state.filter===name)state.filter="all";if(!save())return;refreshCategoryUI();toast("分类已删除")}
function refreshCategoryUI(){buildNav();buildCategorySelect();buildMoveCategorySelect();buildMoveSiteOptions();renderCategoryManager();render();renderCustomList();if(editingSiteId){const s=rawSites().find(x=>x.id===editingSiteId);if(s)fillCategorySelect($("#editSiteCategory"),effectiveCategory(s))}}
function moveCategoryStep(name,delta){const order=allCategories().map(c=>c.name),i=order.indexOf(name),j=i+delta;if(i<0||j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];state.categoryOrder=order;if(!save())return;refreshCategoryUI()}
function bindCategoryDrag(row){
  row.addEventListener("dragstart",e=>{draggedCategoryName=row.dataset.category;row.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",draggedCategoryName)});
  row.addEventListener("dragend",()=>{row.classList.remove("dragging");draggedCategoryName=""});
  row.addEventListener("dragover",e=>{if(!draggedCategoryName||draggedCategoryName===row.dataset.category)return;e.preventDefault();const box=$("#categoryManagerList"),moving=[...box.children].find(x=>x.dataset.category===draggedCategoryName);if(!moving)return;const r=row.getBoundingClientRect();box.insertBefore(moving,e.clientY<r.top+r.height/2?row:row.nextSibling)});
  row.addEventListener("drop",e=>{if(!draggedCategoryName)return;e.preventDefault();state.categoryOrder=[...$("#categoryManagerList").querySelectorAll(".category-manager-item")].map(x=>x.dataset.category);save();refreshCategoryUI()});
}

/* V13 site sort */
function bindSiteDrag(card,grid,site){card.addEventListener("dragstart",e=>{if(!state.sortMode){e.preventDefault();return}draggedSiteId=site.id;siteDropCommitted=false;card.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",site.id)});card.addEventListener("dragend",()=>{card.classList.remove("dragging");$$(".grid.sort-over").forEach(g=>g.classList.remove("sort-over"));if(!siteDropCommitted)render();draggedSiteId=""})}
function nearestCard(grid,x,y){const cards=[...grid.querySelectorAll(".card:not(.dragging)")];let best=null,dist=Infinity,before=true;for(const card of cards){const r=card.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=(x-cx)*(x-cx)+(y-cy)*(y-cy);if(d<dist){dist=d;best=card;before=(y<cy)||(Math.abs(y-cy)<r.height*.28&&x<cx)}}return {best,before}}
function bindGridDrop(grid,targetCategory){
  grid.addEventListener("dragover",e=>{if(!state.sortMode||!draggedSiteId)return;e.preventDefault();e.dataTransfer.dropEffect="move";grid.classList.add("sort-over");const dragging=$$(".card.dragging").find(c=>c.dataset.siteId===draggedSiteId);if(!dragging)return;const {best,before}=nearestCard(grid,e.clientX,e.clientY);if(!best)grid.append(dragging);else grid.insertBefore(dragging,before?best:best.nextSibling)});
  grid.addEventListener("dragleave",e=>{if(!grid.contains(e.relatedTarget))grid.classList.remove("sort-over")});
  grid.addEventListener("drop",e=>{if(!state.sortMode||!draggedSiteId)return;e.preventDefault();siteDropCommitted=true;const site=rawSites().find(s=>s.id===draggedSiteId);if(!site)return render();for(const cat of Object.keys(state.siteOrder)){state.siteOrder[cat]=state.siteOrder[cat].filter(id=>id!==site.id);if(!state.siteOrder[cat].length)delete state.siteOrder[cat]}if(targetCategory===site.category)delete state.categoryOverrides[site.id];else state.categoryOverrides[site.id]=targetCategory;state.siteOrder[targetCategory]=[...grid.querySelectorAll(".card[data-site-id]")].map(card=>card.dataset.siteId);if(!save())return render();buildNav();render();renderCustomList();buildMoveSiteOptions();toast("排序已保存")});
}
function toggleSortMode(){state.sortMode=!state.sortMode;render();toast(state.sortMode?"排序模式：拖动卡片可排序，也可拖到其他分类":"排序已完成")}
async function resetSiteOrder(){if(!Object.keys(state.siteOrder).length)return toast("当前没有自定义网站排序");if(!await uiConfirmV1821("恢复所有网站的默认排序？\\n\\n分类移动不会受影响。"))return;state.siteOrder={};save();render();toast("网站排序已恢复")}
function resetCategoryOrder(){state.categoryOrder=[...CATEGORIES.map(c=>c.name),...state.customCategories.map(c=>c.name)];if(!save())return;refreshCategoryUI();toast("分类排序已恢复")}

/* V13 context menu */
function buildCategoryContext(site){
  const menu=$("#categoryContext");menu.innerHTML="";
  const head=document.createElement("div");head.className="context-head";const iconWrap=createContextHeadIconV187(site);const copy=document.createElement("div");copy.className="context-head-copy";const name=document.createElement("div");name.className="context-head-name";name.textContent=site.name;const cat=document.createElement("div");cat.className="context-head-category";cat.textContent=`当前分类：${contextCategoryLabelV187(effectiveCategory(site))}`;copy.append(name,cat);head.append(iconWrap,copy);
  const label=document.createElement("div");label.className="context-label";label.textContent="移动到分类";const grid=document.createElement("div");grid.className="context-grid";const current=effectiveCategory(site);
  allCategories().forEach(c=>{const btn=document.createElement("button");btn.type="button";btn.className="context-item"+(c.name===current?" current":"");const ci=document.createElement("span");ci.className="context-cat-icon";renderCategoryIcon(ci,c.icon||"•");const cn=document.createElement("span");cn.className="context-cat-name";cn.textContent=contextCategoryLabelV187(c.name);btn.append(ci,cn);if(c.name===current){const check=document.createElement("span");check.className="context-check";check.textContent="✓";btn.append(check)}btn.onclick=e=>{e.preventDefault();e.stopPropagation();applyContextCategory(site,c.name)};grid.append(btn)});
  const footer=document.createElement("div");footer.className="context-footer";const restore=document.createElement("button");restore.type="button";restore.className="context-restore";restore.textContent=`恢复默认：${contextCategoryLabelV187(site.category)}`;restore.hidden=!state.categoryOverrides[site.id];restore.onclick=e=>{e.preventDefault();e.stopPropagation();restoreContextCategory(site)};const tip=document.createElement("span");tip.className="context-tip";tip.textContent="右键 / 长按管理";footer.append(restore,tip);
  const tools=document.createElement("div");tools.className="context-tools";
  const editBtn=document.createElement("button");editBtn.type="button";editBtn.className="context-tool edit-site";editBtn.innerHTML='<span class="context-tool-icon">✎</span><span>编辑网站信息</span>';editBtn.onclick=e=>{e.preventDefault();e.stopPropagation();openSiteEditor(site)};
  const iconBtn=document.createElement("button");iconBtn.type="button";iconBtn.className="context-tool";iconBtn.innerHTML='<span class="context-tool-icon">▧</span><span>自定义图标</span>';iconBtn.onclick=e=>{e.preventDefault();e.stopPropagation();chooseContextIcon(site)};
  const resetIcon=document.createElement("button");resetIcon.type="button";resetIcon.className="context-tool";resetIcon.hidden=!state.iconOverrides[site.id];if(resetIcon.hidden)iconBtn.classList.add("full");resetIcon.innerHTML='<span class="context-tool-icon">↺</span><span>恢复默认图标</span>';resetIcon.onclick=e=>{e.preventDefault();e.stopPropagation();resetContextIcon(site)};
  const copyBtn=document.createElement("button");copyBtn.type="button";copyBtn.className="context-tool copy-url";copyBtn.innerHTML='<span class="context-tool-icon">⧉</span><span>复制网址</span>';copyBtn.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await navigator.clipboard.writeText(site.url);closeCategoryContext();toast("网址已复制")}catch{await uiPromptV1821("复制网址",site.url)}};
  const deleteBtn=document.createElement("button");deleteBtn.type="button";deleteBtn.className="context-tool danger full";deleteBtn.innerHTML='<span class="context-tool-icon">×</span><span>删除网站</span>';deleteBtn.onclick=e=>{e.preventDefault();e.stopPropagation();deleteContextSite(site)};
  tools.append(editBtn,iconBtn,resetIcon,copyBtn,deleteBtn);menu.append(head,label,grid,footer,tools);
}





/* ===================== V17 · Data Driven Runtime ===================== */

/* V19.27 · One canonical glass-preference schema on the existing D1 settings channel.
 * The background image itself remains local in IndexedDB; only three numeric controls sync. */
const LIQUID_UI_SYNC_KEY='__fxnavLiquidUI_v1927';
const LIQUID_UI_LOCAL_KEY='fxnav_liquid_ui_profile_v1927';
const LIQUID_UI_LEGACY_SYNC_KEY='__fxnavLiquidUI_v1926';
const LIQUID_UI_LEGACY_LOCAL_KEY='fxnav_liquid_ui_profile_v1926';
function normalizeLiquidPrefsV1927(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const clamp=(val,min,max,def)=>{const n=Number(val);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):def};
  return {
    opacity:clamp(value.opacity,0,100,32),
    clarity:clamp(value.clarity,0,100,78),
    edge:clamp(value.edge,0,40,8),
    updatedAt:Math.max(0,Number(value.updatedAt)||0)
  };
}
function migrateLiquidPrefsV1926(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const opacity=Number(value.opacity),clarity=Number(value.clarity),edge=Number(value.edge);
  if(!Number.isFinite(opacity)&&!Number.isFinite(clarity)&&!Number.isFinite(edge))return null;
  return normalizeLiquidPrefsV1927({
    opacity:Number.isFinite(opacity)?opacity:32,
    clarity:Number.isFinite(clarity)?clarity:78,
    edge:Number.isFinite(edge)?Math.round(edge*.4):8,
    updatedAt:value.updatedAt||0
  });
}
function localLiquidPrefsV1927(){
  try{
    const current=normalizeLiquidPrefsV1927(JSON.parse(localStorage.getItem(LIQUID_UI_LOCAL_KEY)||'null'));
    if(current)return current;
  }catch{}
  try{
    const previous=migrateLiquidPrefsV1926(JSON.parse(localStorage.getItem(LIQUID_UI_LEGACY_LOCAL_KEY)||'null'));
    if(previous){localStorage.setItem(LIQUID_UI_LOCAL_KEY,JSON.stringify(previous));return previous;}
  }catch{}
  /* One-time migration from the earlier independent slider keys. */
  try{
    const a=localStorage.getItem('fxnav_liquid_glass_opacity_v1913');
    const b=localStorage.getItem('fxnav_liquid_glass_clarity_v1923');
    const c=localStorage.getItem('fxnav_liquid_glass_edge_strength_v1922');
    if(a!==null||b!==null||c!==null){
      const oldOpacity=a===null?32:Number(a);
      const migrated=normalizeLiquidPrefsV1927({
        opacity:a===null?32:(oldOpacity<=42?Math.round(oldOpacity/42*100):oldOpacity),
        clarity:b===null?78:Number(b),
        edge:c===null?8:Math.round(Number(c)*.4),
        updatedAt:0
      });
      localStorage.setItem(LIQUID_UI_LOCAL_KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch{}
  return null;
}
function writeLiquidPrefsV1927(value,refresh=true){
  const clean=normalizeLiquidPrefsV1927(value);if(!clean)return;
  try{localStorage.setItem(LIQUID_UI_LOCAL_KEY,JSON.stringify(clean))}catch{}
  if(refresh)window.__fxLiquidRefreshV1927?.();
}
function saveLocalLiquidToStatsV1927(){
  const prefs=localLiquidPrefsV1927();if(!prefs)return;
  const stats=getUsageStatsV157();
  delete stats[LIQUID_UI_LEGACY_SYNC_KEY];
  stats[LIQUID_UI_SYNC_KEY]=prefs;
  try{STORE.set('fxnav_usage_stats_v157',JSON.stringify(stats))}catch{}
}

const V17_API="/api/data";
const V17_CACHE_KEY="fxnav_v17_bootstrap_cache";
const V17={revision:0,ready:false,syncing:false,suppress:false,pushTimer:0,lastSnapshot:"",pullTimer:0,lastWriteRows:0,lastPullAt:0,pullInFlight:false,resumeInFlight:false};
window.V17=V17;

function v17Query(mode,extra={}){
  const u=new URL(V17_API,location.origin);u.searchParams.set("mode",mode);
  for(const [k,v] of Object.entries(extra||{}))if(v!==undefined&&v!==null)u.searchParams.set(k,String(v));
  return u.pathname+u.search;
}
async function v17Request(mode,method="GET",body=null,extra={}){
  const opts={method,headers:{Accept:"application/json"},credentials:"include",cache:"no-store"};
  if(body!==null&&body!==undefined){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(body)}
  const res=await fetch(v17Query(mode,extra),opts);let data=null;try{data=await res.json()}catch{}
  if(!res.ok){const err=new Error(data?.error||(`HTTP ${res.status}`));err.status=res.status;err.payload=data;throw err}return data;
}
function dataUrlToBlobV17(dataUrl){
  const m=String(dataUrl||"").match(/^data:([^;]+);base64,(.+)$/);if(!m)throw new Error("图标数据无效");
  const bin=atob(m[2]);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:m[1]});
}
async function uploadDataUrlIconV17(siteId,dataUrl){
  const blob=dataUrlToBlobV17(dataUrl);if(blob.size>1024*1024)throw new Error("图标不能超过 1MB");
  const res=await fetch(v17Query("upload-icon",{site:siteId}),{method:"POST",body:blob,headers:{"Content-Type":blob.type||"image/webp"},credentials:"include",cache:"no-store"});
  let data=null;try{data=await res.json()}catch{}if(!res.ok)throw new Error(data?.error||"KV 图标上传失败");return data;
}
function v17IconUrl(row){return `/api/data?mode=icon&site=${encodeURIComponent(row.id)}&v=${encodeURIComponent(row.updated_at||row.updatedAt||Date.now())}`}
function applyBootstrapV17(payload,{cache=true}={}){
  if(!payload?.ok)return false;V17.suppress=true;
  try{
    const cats=Array.isArray(payload.categories)?payload.categories:[];
    const rows=Array.isArray(payload.sites)?payload.sites:[];
    const settings=payload.settings&&typeof payload.settings==="object"?payload.settings:{};
    CATEGORIES=cats.filter(c=>Number(c.is_builtin)!==0).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(c=>({name:c.name,icon:c.icon||"•",count:0}));
    state.customCategories=cats.filter(c=>Number(c.is_builtin)===0).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(c=>({name:c.name,icon:c.icon||"•"}));
    state.categoryOrder=cats.slice().sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(c=>c.name);
    state.categoryIconOverrides={};state.categoryOverrides={};state.siteEdits={};state.iconOverrides={};
    const mapRow=row=>({id:row.id,name:row.name,url:row.url,category:row.category_name,domain:row.domain||safeDomain(row.url),fullTitle:row.full_title||row.name,icon:"",iconUrl:v17IconUrl(row),_sourceIconUrl:row.icon_url||"",_customIcon:!!(row.has_custom_icon||row.icon_key),_v17Updated:row.updated_at||""});
    BUILTIN_SITES=rows.filter(r=>Number(r.is_custom)===0).map(mapRow);
    state.custom=rows.filter(r=>Number(r.is_custom)!==0).map(mapRow);
    state.favorites=new Set(rows.filter(r=>Number(r.is_favorite)!==0).map(r=>r.id));
    state.hiddenSites=new Set(rows.filter(r=>Number(r.is_deleted)!==0).map(r=>r.id));
    state.recents=Array.isArray(settings.recents)?settings.recents:[];
    // Merge last-edit-wins glass profile; never clobber more recent local adjustments.
    const __cloudStats=(settings.usageStats&&typeof settings.usageStats==='object'&&!Array.isArray(settings.usageStats))?settings.usageStats:{};
    const __remoteUi=(normalizeLiquidPrefsV1927(__cloudStats[LIQUID_UI_SYNC_KEY])||migrateLiquidPrefsV1926(__cloudStats[LIQUID_UI_LEGACY_SYNC_KEY]));
    const __localUi=localLiquidPrefsV1927();
    const __preferLocal=!!(__localUi&&(!__remoteUi||__localUi.updatedAt>__remoteUi.updatedAt));
    const __chosenUi=__preferLocal?__localUi:__remoteUi;
    const __mergedStats={...__cloudStats};delete __mergedStats[LIQUID_UI_LEGACY_SYNC_KEY];
    if(__chosenUi)__mergedStats[LIQUID_UI_SYNC_KEY]=__chosenUi;
    STORE.set('fxnav_usage_stats_v157',JSON.stringify(__mergedStats));
    if(__chosenUi)writeLiquidPrefsV1927(__chosenUi,true);
    const grouped={};
    rows.slice().sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).forEach(r=>{(grouped[r.category_name]??=[]).push(r.id)});state.siteOrder=grouped;
    sanitizeState();saveLocalState();applyTheme();if(typeof applyDensityV157==="function")applyDensityV157();buildNav();buildCategorySelect();buildMoveCategorySelect();buildMoveSiteOptions();render();renderCategoryManager();renderDeletedList();renderCustomList();refreshIconPreview();updateStorageUsage();
    V17.revision=Number(payload.revision)||0;V17.ready=true;V17.lastSnapshot=JSON.stringify(makeV17Snapshot());if(cache)STORE.set(V17_CACHE_KEY,JSON.stringify(payload));
    if(__preferLocal||(!__cloudStats[LIQUID_UI_SYNC_KEY]&&!!__cloudStats[LIQUID_UI_LEGACY_SYNC_KEY])){
      V17.lastSnapshot=''; // Local change newer than server: send after bootstrap exits suppression.
      setTimeout(()=>{if(V17.ready&&!V17.suppress)window.__fxCloudSchedulePush?.()},500);
    }
    setCloudStatus("synced","D1 已同步",`Cloudflare D1 SQLite 数据库 · 数据版本 ${V17.revision} · KV 图标缓存正常`);return true;
  }finally{V17.suppress=false}
}
function makeV17Snapshot(){
  const cats=allCategories();const rankByCat={};
  cats.forEach((c,ci)=>{const items=rawSites().filter(s=>effectiveCategory(s)===c.name);orderedSites(items,c.name).forEach((s,i)=>{rankByCat[s.id]=i})});
  const siteRows=rawSites().map(site=>{
    const iconUrl=String(site.iconUrl||"");const sourceIconUrl=iconUrl.startsWith("/api/")?(site._sourceIconUrl||""):iconUrl;
    return {id:site.id,name:site.name,url:site.url,fullTitle:site.fullTitle||site.name,category:effectiveCategory(site),sortOrder:Number(rankByCat[site.id]||0),isFavorite:state.favorites.has(site.id),isDeleted:state.hiddenSites.has(site.id),isCustom:!isBuiltinSite(site.id),iconUrl:sourceIconUrl};
  });
  return {baseRevision:V17.revision,categories:cats.map((c,i)=>({name:c.name,icon:c.icon||"•",sortOrder:i,isBuiltin:!!c.builtin})),sites:siteRows,settings:{recents:state.recents.slice(0,30),usageStats:typeof getUsageStatsV157==="function"?getUsageStatsV157():{}}};
}
async function pushV17({force=false}={}){
  if(!V17.ready||V17.suppress)return false;
  if(V17.syncing){
    clearTimeout(V17.pushTimer);
    V17.pushTimer=setTimeout(()=>pushV17({force}),900);
    return false;
  }
  const snap=makeV17Snapshot();
  const hash=JSON.stringify(snap);
  if(!force&&hash===V17.lastSnapshot)return true;
  V17.syncing=true;
  setCloudStatus("syncing","D1 保存中…","Cloudflare D1 SQLite 数据库 · 正在同步导航数据");
  try{
    let sentSnap=snap;
    let res;
    try{
      res=await v17Request("sync","POST",{...sentSnap,force});
    }catch(err){
      if(err.status===409&&err.payload?.revision){
        V17.revision=Number(err.payload.revision)||V17.revision;
        sentSnap=makeV17Snapshot();
        res=await v17Request("sync","POST",{...sentSnap,force:true});
      }else{
        throw err;
      }
    }
    V17.revision=Number(res.revision)||V17.revision;
    V17.lastWriteRows=Math.max(0,Number(res.writes)||0);
    V17.lastSnapshot=JSON.stringify({...sentSnap,baseRevision:V17.revision});
    setCloudStatus("synced","D1 已同步",`Cloudflare D1 SQLite 数据库 · 数据版本 ${V17.revision} · 本次增量写入 ${V17.lastWriteRows} 行`);
    // If local state changed while the request was in flight, queue one more save.
    if(JSON.stringify(makeV17Snapshot())!==V17.lastSnapshot){
      clearTimeout(V17.pushTimer);
      V17.pushTimer=setTimeout(()=>pushV17(),900);
    }
    return true;
  }catch(err){
    if(err.status===401){showLoginGateV161("登录已失效，请重新登录。");setCloudStatus("error","登录失效","请重新登录")}
    else if(!navigator.onLine)setCloudStatus("offline","D1 离线","网络不可用 · 本地修改已保留，联网后自动同步")
    else setCloudStatus("error","D1 同步失败",err.message||"同步失败");
    return false;
  }finally{
    V17.syncing=false;
  }
}
function scheduleDataSyncV17(){if(!V17.ready||V17.suppress)return;clearTimeout(V17.pushTimer);setCloudStatus("syncing","D1 保存中…","本地已保存 · 准备写入 Cloudflare D1 SQLite 数据库");V17.pushTimer=setTimeout(()=>pushV17(),1200)}
window.__fxCloudSchedulePush=scheduleDataSyncV17;
async function refreshV17FromServer({quiet=false}={}){
  try{const payload=await v17Request("bootstrap");if(Number(payload.revision)!==V17.revision||!V17.ready)applyBootstrapV17(payload);else if(!quiet)setCloudStatus("synced","D1 已同步",`Cloudflare D1 SQLite 数据库 · 数据版本 ${V17.revision}`);return true}
  catch(err){if(err.status===401)showLoginGateV161("请登录后读取 D1 数据");else if(!quiet)setCloudStatus("error","D1 未连接",err.message||"无法读取 D1");return false}
}
const V17_PULL_COOLDOWN=15000;
async function requestV17Refresh({quiet=true,force=false}={}){
  if(!AUTH_V161.authenticated||!navigator.onLine)return false;
  if(!force&&document.visibilityState==="hidden")return false;
  const now=Date.now();
  if(!force&&now-V17.lastPullAt<V17_PULL_COOLDOWN)return false;
  if(V17.pullInFlight)return false;
  V17.pullInFlight=true;V17.lastPullAt=now;
  try{return await refreshV17FromServer({quiet})}finally{V17.pullInFlight=false}
}
async function reconcileV17OnResume({forcePull=false}={}){
  if(!AUTH_V161.authenticated||!navigator.onLine||V17.resumeInFlight)return false;
  V17.resumeInFlight=true;
  try{
    if(V17.ready&&!V17.suppress){
      const dirty=JSON.stringify(makeV17Snapshot())!==V17.lastSnapshot;
      if(dirty)return await pushV17();
    }
    return await requestV17Refresh({quiet:true,force:forcePull});
  }finally{V17.resumeInFlight=false}
}
function handleV17WindowFocus(){reconcileV17OnResume()}
function handleV17VisibilityChange(){if(document.visibilityState==="visible")reconcileV17OnResume()}
function handleV17Online(){setTimeout(()=>reconcileV17OnResume({forcePull:true}),120)}
function handleV17PageShow(e){if(e.persisted)reconcileV17OnResume({forcePull:true})}
async function initDataDrivenV17(){
  setCloudStatus("syncing","D1 连接中…","正在读取 Cloudflare D1 SQLite 数据库");
  const ok=await refreshV17FromServer();V17.lastPullAt=Date.now();if(!ok){const cached=parseStored(V17_CACHE_KEY,null);if(cached){applyBootstrapV17(cached,{cache:false});setCloudStatus("offline","本地缓存","暂时使用最近一次 D1 缓存")}}
  clearInterval(V17.pullTimer);V17.pullTimer=0;
  window.removeEventListener("focus",handleV17WindowFocus);
  document.removeEventListener("visibilitychange",handleV17VisibilityChange);
  window.removeEventListener("online",handleV17Online);
  window.removeEventListener("pageshow",handleV17PageShow);
  window.addEventListener("focus",handleV17WindowFocus,{passive:true});
  document.addEventListener("visibilitychange",handleV17VisibilityChange,{passive:true});
  window.addEventListener("online",handleV17Online,{passive:true});
  window.addEventListener("pageshow",handleV17PageShow,{passive:true});
}

/* ===================== V16.1 · Private Login Runtime ===================== */
const AUTH_API="/api/state";
const AUTH_V161={
  authenticated:false,
  username:"",
  checking:false
};

function authFetchV161(mode,method="GET",body){
  const url=AUTH_API+"?mode="+encodeURIComponent(mode);
  const opts={
    method,
    headers:{"Accept":"application/json"},
    credentials:"include",
    cache:"no-store"
  };
  if(body!==undefined){
    opts.headers["Content-Type"]="application/json";
    opts.body=JSON.stringify(body);
  }
  return fetch(url,opts).then(async res=>{
    let payload=null;
    try{payload=await res.json()}catch{}
    if(!res.ok){
      const err=new Error(payload?.error||("HTTP "+res.status));
      err.status=res.status;
      err.payload=payload;
      throw err;
    }
    return payload;
  });
}

function showLoginGateV161(message=""){
  const gate=$("#loginGate"),error=$("#loginError");
  if(!gate)return;
  document.body.classList.add("auth-locked");
  gate.classList.add("show");
  gate.setAttribute("aria-hidden","false");
  if(error)error.textContent=message||"";
  $("#logoutBtn")?.setAttribute("hidden","");
  setCloudStatus("offline","未登录","登录后启用 D1 云同步");
  setTimeout(()=>$("#loginUsername")?.focus(),40);
}

function hideLoginGateV161(){
  const gate=$("#loginGate"),error=$("#loginError");
  document.body.classList.remove("auth-locked");
  if(gate){
    gate.classList.remove("show");
    gate.setAttribute("aria-hidden","true");
  }
  if(error)error.textContent="";
  $("#logoutBtn")?.removeAttribute("hidden");
}

async function checkAuthV161(){
  if(AUTH_V161.checking)return false;
  AUTH_V161.checking=true;
  try{
    const result=await authFetchV161("me");
    AUTH_V161.authenticated=!!result.authenticated;
    AUTH_V161.username=result.username||"";
    if(AUTH_V161.authenticated){
      hideLoginGateV161();
      return true;
    }
    showLoginGateV161();
    return false;
  }catch(err){
    AUTH_V161.authenticated=false;
    if(err.status===401){
      showLoginGateV161();
    }else if(err.status===500){
      showLoginGateV161("服务器登录变量还没配置完成。");
      setCloudStatus("error","登录未配置","请在 Cloudflare Pages 中配置 NAV_USERNAME / NAV_PASSWORD / SESSION_SECRET");
    }else{
      showLoginGateV161("暂时无法连接登录接口，请稍后重试。");
      setCloudStatus("error","登录接口异常",err.message||"登录接口异常");
    }
    return false;
  }finally{
    AUTH_V161.checking=false;
  }
}

async function doLoginV161(username,password){
  const btn=$("#loginSubmit"),error=$("#loginError");
  if(btn){btn.disabled=true;btn.textContent="正在登录…"}
  if(error)error.textContent="";
  try{
    const result=await authFetchV161("login","POST",{username,password});
    AUTH_V161.authenticated=true;
    AUTH_V161.username=result.username||username;
    hideLoginGateV161();
    setCloudStatus("syncing","登录成功","正在读取云端数据");
    await initDataDrivenV17();
    toast("登录成功，云同步已启用");
    return true;
  }catch(err){
    let msg=err.payload?.error||"登录失败";
    if(err.status===429)msg="尝试次数过多，请稍后再试。";
    else if(err.status===401)msg="用户名或密码错误。";
    else if(err.status===500)msg="服务器登录变量未配置完整。";
    if(error)error.textContent=msg;
    setCloudStatus("error","登录失败",msg);
    $("#loginPassword")?.focus();
    $("#loginPassword")?.select();
    return false;
  }finally{
    if(btn){btn.disabled=false;btn.textContent="登录并同步"}
  }
}

async function logoutV161(){
  try{await authFetchV161("logout","POST",{})}catch{}
  AUTH_V161.authenticated=false;
  AUTH_V161.username="";
  V17.ready=false;
  clearTimeout(V17.pushTimer);
  clearInterval(V17.pullTimer);
  setCloudStatus("offline","未登录","已退出私人导航");
  showLoginGateV161("你已退出登录。");
  $("#loginPassword").value="";
}

async function initAuthV161(){
  setCloudStatus("syncing","检查登录…","正在验证私人导航会话");
  const ok=await checkAuthV161();
  if(ok){
    setCloudStatus("syncing","连接云端…","登录有效，正在连接 D1");
    await initDataDrivenV17();
  }
}

$("#loginForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const username=$("#loginUsername").value.trim();
  const password=$("#loginPassword").value;
  if(!username||!password)return;
  doLoginV161(username,password);
});

$("#toggleLoginPassword")?.addEventListener("click",()=>{
  const input=$("#loginPassword");
  if(!input)return;
  input.type=input.type==="password"?"text":"password";
  $("#toggleLoginPassword").textContent=input.type==="password"?"◉":"◎";
  input.focus();
});

$("#logoutBtn")?.addEventListener("click",async()=>{
  if(await uiConfirmV1821("退出私人导航登录？"))logoutV161();
});

/* ===================== V18.7 · Cloud Status ===================== */
function setCloudStatus(mode,text,title=""){
  const el=$("#cloudStatus"),txt=$("#cloudStatusText"),compact=$("#compactCloudStatus");
  const detail=title||text||"Cloudflare D1 SQLite 数据库";
  if(el){
    el.dataset.state=mode||"";
    if(txt)txt.textContent=text||"";
    el.title=detail;
  }
  if(compact){
    compact.dataset.state=mode||"";
    compact.title=detail;
  }
}

const __v15Migrated=migrateBuiltinDataV15();sanitizeState();if(save()&&__v15Migrated)STORE.set(V15_BUILTIN_DATA_KEY,V15_BUILTIN_DATA_VERSION);applyTheme();buildNav();buildCategorySelect();buildMoveCategorySelect();buildMoveSiteOptions();render();renderCategoryManager();renderDeletedList();refreshIconPreview();updateStorageUsage();setTimeout(initPublicAdminV178,80);

let searchRenderRAF=0;
function queueSearchRender(value){
  state.query=value;
  const main=$("#searchInput"),compact=$("#compactSearchInput");
  if(main&&main.value!==value)main.value=value;
  if(compact&&compact.value!==value)compact.value=value;
  $("#clearSearch").classList.toggle("show",!!value);
  document.body.classList.toggle("searching",!!value.trim());
  cancelAnimationFrame(searchRenderRAF);
  searchRenderRAF=requestAnimationFrame(render);
}
$("#searchInput").addEventListener("input",e=>queueSearchRender(e.target.value));
$("#compactSearchInput").addEventListener("input",e=>queueSearchRender(e.target.value));

function handleSearchKeydown(e){
  if(e.key==="Escape"&&state.query){
    queueSearchRender("");
    e.currentTarget.value="";
  }else if(e.key==="Enter"){
    const results=filteredSites();
    if(results.length===1){recordRecent(results[0].id);window.open(results[0].url,"_blank","noopener")}
  }
}
$("#searchInput").addEventListener("keydown",handleSearchKeydown);
$("#compactSearchInput").addEventListener("keydown",handleSearchKeydown);
$("#clearSearch").onclick=()=>{setSearchQuery("",{focus:true})};

document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
    e.preventDefault();
    const target=$("#compactBar").classList.contains("show")?$("#compactSearchInput"):$("#searchInput");
    target.focus();target.select();
  }
  if(e.key==="Escape"&&!document.activeElement.matches("#searchInput,#compactSearchInput")){closeDrawer();$("#sidebar").classList.remove("show")}
});

/* V18.34: theme and density are device-local UI preferences; never schedule D1 writes. */
function toggleThemeV153(){
  const root=document.documentElement;
  const current=root.dataset.theme||"dark";
  const order=["dark","light","neon","liquid","frosted"];
  const next=order[(Math.max(0,order.indexOf(current))+1)%order.length];

  /* V18.34: suppress every inherited/card transition before changing data-theme.
     This prevents 200+ cards from animating borders/shadows during a theme swap. */
  const seq=(toggleThemeV153._seq=(toggleThemeV153._seq||0)+1);
  root.classList.add("theme-switching");
  root.dataset.theme=next;
  STORE.set(KEYS.theme,next);
  updateThemeButton();
  syncCompactControls();

  const activeBtn=document.activeElement?.id==="compactThemeBtn"?$("#compactThemeBtn"):$("#themeBtn");
  [$("#themeBtn"),$("#compactThemeBtn")].forEach(btn=>btn?.classList.remove("theme-tap-feedback"));

  /* Two paint frames are enough for the target theme to land. Then normal hover
     transitions are restored. Sequence guard keeps rapid repeated taps safe. */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(seq!==toggleThemeV153._seq)return;
    root.classList.remove("theme-switching");
    if(activeBtn){
      activeBtn.classList.add("theme-tap-feedback");
      clearTimeout(toggleThemeV153._feedbackTimer);
      toggleThemeV153._feedbackTimer=setTimeout(()=>activeBtn.classList.remove("theme-tap-feedback"),150);
    }
  }));

  const names={dark:"深色主题",light:"浅色主题",liquid:"液态玻璃主题",neon:"霓虹星球主题",frosted:"磨砂半透主题"};
  toast(`已切换${names[next]}`);
}
$("#themeBtn").onclick=toggleThemeV153;
$("#compactThemeBtn").onclick=toggleThemeV153;
$("#mobileMenuBtn").onclick=()=>$("#sidebar").classList.toggle("show");
$("#manageBtn").onclick=openDrawer;
$("#compactManageBtn").onclick=openDrawer;
$("#closeDrawer").onclick=closeDrawer;
$("#backdrop").onclick=closeDrawer;
$("#sortModeBtn").onclick=toggleSortMode;
$("#compactSortBtn").onclick=toggleSortMode;
/* V18.8：Hero 右侧已改为日历 + 时钟。 */
$("#addCategoryBtn").onclick=addCustomCategory;
$("#applyRecommendedCategoryIconsBtn").onclick=applyRecommendedCategoryIcons;
$("#newCategoryGlyph").addEventListener("input",updateNewCategoryGlyphPreview);
updateNewCategoryGlyphPreview();
$("#categoryIconEditorInput").addEventListener("input",updateCategoryIconEditorPreview);
$("#saveCategoryIconEditorBtn").onclick=saveCategoryIconEditor;
$("#cancelCategoryIconEditorBtn").onclick=closeCategoryIconEditor;
$("#closeCategoryIconEditor").onclick=closeCategoryIconEditor;
$("#categoryIconEditorBackdrop").addEventListener("pointerdown",e=>{if(e.target===$("#categoryIconEditorBackdrop"))closeCategoryIconEditor()});
$("#categoryIconEditorInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();saveCategoryIconEditor()}else if(e.key==="Escape"){e.preventDefault();closeCategoryIconEditor()}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#categoryIconEditorBackdrop")?.classList.contains("show"))closeCategoryIconEditor()});
$("#resetCategoryOrderBtn").onclick=resetCategoryOrder;
$("#resetSiteOrderBtn").onclick=resetSiteOrder;
$("#closeSiteEditor").onclick=closeSiteEditor;
$("#cancelSiteEditor").onclick=closeSiteEditor;
$("#saveSiteEditor").onclick=saveSiteEditor;
$("#restoreSiteInfoBtn").onclick=restoreSiteInfo;
$("#siteEditorBackdrop").addEventListener("pointerdown",e=>{if(e.target===$("#siteEditorBackdrop"))closeSiteEditor()});
["editSiteName","editSiteUrl","editSiteIconUrl"].forEach(id=>$("#"+id).addEventListener("input",refreshSiteEditorPreview));
$("#moveSearch").addEventListener("input",buildMoveSiteOptions);
$("#moveSiteSelect").addEventListener("change",()=>{
  const site=getMoveSite();
  if(site)$("#moveCategorySelect").value=effectiveCategory(site);
  updateMovePreview();
});
$("#moveCategorySelect").addEventListener("change",updateMovePreview);
$("#moveCategoryBtn").onclick=moveSelectedCategory;
$("#restoreCategoryBtn").onclick=restoreSelectedCategory;

$("#contextIconFile").addEventListener("change",e=>{
  const file=e.target.files?.[0];
  if(file)applyContextIconFile(file);
  e.target.value="";
});

["newName","newUrl","newIconUrl"].forEach(id=>$("#"+id).addEventListener("input",refreshIconPreview));
$("#newIconFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{state.pendingIconData=await optimizeIconFile(file);refreshIconPreview()}
  catch(err){alert(err?.message||"图标处理失败")}
  e.target.value="";
});
$("#addForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("#newName").value.trim();
  const url=$("#newUrl").value.trim();
  const category=$("#newCategory").value;
  const iconUrlRaw=$("#newIconUrl").value.trim();
  try{
    const u=validHttpUrl(url);if(!u)throw new Error("请输入有效的 http:// 或 https:// 网址");
    const iconUrl=iconUrlRaw?validIconValue(iconUrlRaw):"";
    if(iconUrlRaw&&!iconUrl)throw new Error("图标地址只支持 http/https 图片地址");
    const canon=canonicalUrl(u.href);
    const duplicate=rawSites().find(s=>canonicalUrl(s.url)===canon);
    if(duplicate)throw new Error(`这个网址已经存在：${duplicate.name}`);
    const id=crypto?.randomUUID?"c"+crypto.randomUUID():"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    const pendingUpload=validIconValue(state.pendingIconData);
    const site={id,name:name||u.hostname,url:u.href,category,domain:u.hostname.replace(/^www\./,""),fullTitle:name||u.hostname,icon:"",iconUrl};
    state.custom.push(site);
    if(!save()){state.custom=state.custom.filter(x=>x.id!==id);return}
    e.target.reset();state.pendingIconData="";refreshIconPreview();buildNav();render();renderCustomList();buildMoveSiteOptions();toast("已添加到导航");
    if(pendingUpload)setTimeout(()=>uploadDataUrlIconV17(id,pendingUpload).then(()=>refreshV17FromServer({quiet:true})).catch(err=>toast(err?.message||"图标上传失败")),80);
  }catch(err){alert(err?.message||"添加失败")}
});
function exportBrowserBookmarksV1852(){
  const escapeBookmarkHtml=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const activeSites=(typeof allSites==="function"?allSites():[]).filter(site=>{
    try{const u=new URL(String(site?.url||""));return u.protocol==="http:"||u.protocol==="https:"}catch{return false}
  });
  if(!activeSites.length)return toast("没有可导出的有效网站");
  const categories=typeof allCategories==="function"?allCategories():[];
  const addDate=Math.floor(Date.now()/1000);
  const lines=[
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>私人导航工具箱</TITLE>',
    '<H1>私人导航工具箱</H1>',
    '<DL><p>',
    `    <DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${addDate}">私人导航工具箱</H3>`,
    '    <DL><p>'
  ];
  let exported=0,folderCount=0;
  const used=new Set();
  const appendCategory=(rawName,catSites)=>{
    if(!catSites.length)return;
    const displayName=String(window.categoryDisplayNameV18?.(rawName)||state.categoryTitleOverrides?.[rawName]||rawName||"未分类").trim()||"未分类";
    lines.push(`        <DT><H3 ADD_DATE="${addDate}" LAST_MODIFIED="${addDate}">${escapeBookmarkHtml(displayName)}</H3>`);
    lines.push('        <DL><p>');
    catSites.forEach(site=>{
      const href=String(site.url||"").trim();
      const title=String(site.name||site.fullTitle||site.domain||safeDomain(href)||href).trim()||href;
      lines.push(`            <DT><A HREF="${escapeBookmarkHtml(href)}" ADD_DATE="${addDate}">${escapeBookmarkHtml(title)}</A>`);
      exported++;
      used.add(site.id);
    });
    lines.push('        </DL><p>');
    folderCount++;
  };
  categories.forEach(cat=>{
    const items=activeSites.filter(site=>effectiveCategory(site)===cat.name);
    appendCategory(cat.name,typeof orderedSites==="function"?orderedSites(items,cat.name):items);
  });
  // Safety net for any valid site whose category is no longer present.
  const remaining=activeSites.filter(site=>!used.has(site.id));
  appendCategory("未分类",remaining);
  lines.push('    </DL><p>','</DL><p>');
  const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/html;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  const d=new Date(),pad=n=>String(n).padStart(2,"0"),ds=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  a.href=url;a.download=`private-nav-bookmarks-${ds}.html`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800);
  toast(`已导出 ${exported} 个网站 · ${folderCount} 个分类，可导入 Chrome / Edge`);
}


function cleanBookmarkCategoryV1860(value){
  const text=String(value||"").replace(/[\u0000-\u001f<>:"/\\|?*]/g," ").replace(/\s+/g," ").trim();
  return (text||"浏览器书签").slice(0,24);
}
function bookmarkFolderCategoryV1860(path){
  const wrappers=new Set(["bookmarks","bookmarks bar","bookmarks menu","bookmarks toolbar","other bookmarks","mobile bookmarks","收藏夹","收藏夹栏","书签","书签栏","其他收藏夹","移动设备书签","私人导航工具箱"]);
  const parts=(Array.isArray(path)?path:[]).map(v=>String(v||"").trim()).filter(Boolean);
  for(let i=parts.length-1;i>=0;i--){if(!wrappers.has(parts[i].toLowerCase()))return cleanBookmarkCategoryV1860(parts[i])}
  return "浏览器书签";
}
function parseBrowserBookmarksV1860(html){
  const doc=new DOMParser().parseFromString(String(html||""),"text/html");
  const root=doc.querySelector("dl");
  if(!root)throw new Error("没有识别到 Chrome / Edge 书签结构");
  const rows=[];
  const walk=(container,path=[])=>{
    const children=[...container.children];
    for(let i=0;i<children.length;i++){
      const el=children[i];
      if(el.tagName==="DT"){
        const direct=[...el.children];
        const h3=direct.find(x=>x.tagName==="H3")||null;
        const a=direct.find(x=>x.tagName==="A")||null;
        if(a){
          const href=String(a.getAttribute("href")||"").trim();
          try{
            const u=new URL(href);
            if(u.protocol!=="http:"&&u.protocol!=="https:")continue;
            rows.push({name:String(a.textContent||u.hostname).trim()||u.hostname,url:u.href,category:bookmarkFolderCategoryV1860(path)});
          }catch{}
        }
        if(h3){
          let nested=direct.find(x=>x.tagName==="DL")||null;
          if(!nested){
            const next=children[i+1];
            if(next?.tagName==="DL"){nested=next;i++}
          }
          if(nested)walk(nested,[...path,String(h3.textContent||"").trim()]);
        }else{
          direct.filter(x=>x.tagName==="DL").forEach(dl=>walk(dl,path));
        }
      }else if(el.tagName==="DL")walk(el,path);
      else if(el.tagName==="P")walk(el,path);
    }
  };
  walk(root,[]);
  if(!rows.length){
    // Fallback for browser-produced HTML that the parser normalized differently.
    doc.querySelectorAll("a[href]").forEach(a=>{
      const href=String(a.getAttribute("href")||"").trim();
      try{const u=new URL(href);if(u.protocol!=="http:"&&u.protocol!=="https:")return;rows.push({name:String(a.textContent||u.hostname).trim()||u.hostname,url:u.href,category:"浏览器书签"})}catch{}
    });
  }
  return rows;
}
function resolveImportCategoryV1860(name,createdMap){
  const desired=cleanBookmarkCategoryV1860(name);
  if(createdMap.has(desired))return createdMap.get(desired);
  const cats=allCategories();
  const exact=cats.find(c=>String(c.name)===desired);
  if(exact){createdMap.set(desired,exact.name);return exact.name}
  const byDisplay=cats.find(c=>String(window.categoryDisplayNameV18?.(c.name)||c.name).trim()===desired);
  if(byDisplay){createdMap.set(desired,byDisplay.name);return byDisplay.name}
  let actual=desired,n=2;
  const names=new Set(cats.map(c=>String(c.name)));
  while(names.has(actual)){actual=`${desired.slice(0,20)} ${n++}`.slice(0,24)}
  state.customCategories.push({name:actual,icon:"◇"});
  if(!state.categoryOrder.includes(actual))state.categoryOrder.push(actual);
  createdMap.set(desired,actual);
  return actual;
}
async function importBrowserBookmarksV1860(file){
  if(!AUTH_V161.authenticated)return requestAdminV178(()=>document.getElementById("importBookmarksFile")?.click(),"导入浏览器书签会写入 D1，请先登录管理员。");
  if(!file)return;
  if(file.size>8*1024*1024)throw new Error("书签 HTML 超过 8MB，请拆分后再导入");
  const parsed=parseBrowserBookmarksV1860(await file.text());
  if(!parsed.length)throw new Error("没有找到可导入的 http/https 网站");
  const existing=new Set(rawSites().map(s=>canonicalUrl(s.url)).filter(Boolean));
  const seen=new Set();
  const fresh=[];
  let duplicates=0,invalid=0;
  for(const item of parsed){
    const canon=canonicalUrl(item.url);
    if(!canon){invalid++;continue}
    if(existing.has(canon)||seen.has(canon)){duplicates++;continue}
    seen.add(canon);fresh.push({...item,canonical:canon});
  }
  const uniqueFolders=[...new Set(fresh.map(x=>cleanBookmarkCategoryV1860(x.category)))];
  const msg=`检测到 ${parsed.length} 个浏览器书签。\n\n将新增：${fresh.length} 个网站\n自动跳过重复：${duplicates} 个\n分类：${uniqueFolders.length} 个${invalid?`\n无效网址：${invalid} 个`:""}\n\n导入后会写入 Cloudflare D1，继续？`;
  if(!fresh.length){toast(`没有需要导入的新网站 · 已跳过 ${duplicates} 个重复项`);return}
  if(!await uiConfirmV1821(msg))return;
  const createdMap=new Map(),added=[];
  for(const item of fresh){
    const category=resolveImportCategoryV1860(item.category,createdMap);
    const u=new URL(item.url);
    const id=crypto?.randomUUID?"c"+crypto.randomUUID():"c"+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
    const site={id,name:String(item.name||u.hostname).trim().slice(0,120)||u.hostname,url:u.href,category,domain:u.hostname.replace(/^www\./,""),fullTitle:String(item.name||u.hostname).trim().slice(0,180)||u.hostname,icon:"",iconUrl:""};
    state.custom.push(site);added.push(site);
  }
  sanitizeState();
  if(!save())throw new Error("浏览器本地存储空间不足，导入未保存");
  refreshCategoryUI();renderDeletedList();renderCustomList();buildMoveSiteOptions();updateStorageUsage();
  clearTimeout(V17.pushTimer);
  const synced=await pushV17({force:true});
  if(synced){await refreshV17FromServer({quiet:true});toast(`已导入 ${added.length} 个网站 · 跳过 ${duplicates} 个重复项 · 图标将自动高清缓存`)}
  else toast(`已导入 ${added.length} 个网站到本机，但 D1 同步失败，请稍后点“立即同步”`);
}
function downloadJsonV1860(payload,filename){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportDisasterBackupV1860(){
  if(!AUTH_V161.authenticated)return requestAdminV178(exportDisasterBackupV1860,"完整备份包含 D1 与 KV 自定义图标，仅管理员可以导出。");
  const btns=[document.getElementById("disasterBackupBtn"),document.getElementById("managerDisasterBackup")].filter(Boolean);
  btns.forEach(b=>b.disabled=true);
  try{
    toast("正在生成完整备份…");
    const payload=await v17Request("disaster-backup");
    payload.schemaVersion=window.FXNAV_APP?.schemaVersion||3;
    payload.appVersion=window.FXNAV_APP?.version||"19.21";
    payload.client={
      theme:document.documentElement.dataset.theme||"dark",
      density:STORE.get(V157_DENSITY_KEY)||"comfortable",
      origin:location.origin,
      exportedAt:new Date().toISOString()
    };
    const d=new Date(),pad=n=>String(n).padStart(2,"0");
    const stamp=`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    downloadJsonV1860(payload,`private-nav-backup-v${window.FXNAV_APP?.version||"19.21"}-${stamp}.json`);
    const sites=Array.isArray(payload?.d1?.sites)?payload.d1.sites.length:0;
    const cats=Array.isArray(payload?.d1?.categories)?payload.d1.categories.length:0;
    const icons=Number(payload?.kv?.customIconCount)||0;
    toast(`完整备份已导出 · ${sites} 个网站 · ${cats} 个分类 · ${icons} 个自定义图标`);
  }catch(err){
    if(err?.status===413){if(typeof window.uiAlertV1821==="function")await window.uiAlertV1821(err.message||"自定义图标数据过大，请先清理无用图标后重试",{title:"完整备份过大"});else alert(err.message||"完整备份过大");}
    else toast(err?.message||"完整备份导出失败");
  }finally{btns.forEach(b=>b.disabled=false)}
}

$("#importBookmarksBtn").onclick=()=>$("#importBookmarksFile").click();
$("#importBookmarksFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0];
  try{if(file)await importBrowserBookmarksV1860(file)}catch(err){toast(err?.message||"浏览器书签导入失败")}finally{e.target.value=""}
});
$("#disasterBackupBtn").onclick=exportDisasterBackupV1860;

$("#exportBookmarksBtn").onclick=exportBrowserBookmarksV1852;

$("#exportBtn").onclick=()=>{
  const payload={schemaVersion:window.FXNAV_APP?.schemaVersion||3,appVersion:window.FXNAV_APP?.version||"19.21",version:window.FXNAV_APP?.version||"19.21",favorites:[...state.favorites],recents:state.recents,custom:state.custom,categoryOverrides:state.categoryOverrides,iconOverrides:state.iconOverrides,hiddenSites:[...state.hiddenSites],siteEdits:state.siteEdits,customCategories:state.customCategories,categoryOrder:state.categoryOrder,categoryIconOverrides:state.categoryIconOverrides,siteOrder:state.siteOrder,categoryTitleOverrides:{...(state.categoryTitleOverrides||{})},duplicateIgnoreKeys:[...(state.duplicateIgnoreKeys||new Set())],usageStats:getUsageStatsV157(),density:STORE.get(V157_DENSITY_KEY)||"comfortable",theme:document.documentElement.dataset.theme||"dark",cloudRevision:V17.revision};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);const ds=new Date().toISOString().slice(0,10).replaceAll("-","");a.download=`private-nav-v${window.FXNAV_APP?.version||"19.21"}-${ds}.json`;a.click();URL.revokeObjectURL(a.href);
};
$("#importBtn").onclick=()=>$("#importFile").click();
$("#importFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(file.size>4*1024*1024)throw new Error("备份文件过大，拒绝导入");
    const d=JSON.parse(await file.text());if(!d||typeof d!=="object")throw new Error("配置格式无效");const schema=Number(d.schemaVersion||1);if(schema>(window.FXNAV_APP?.schemaVersion||3))throw new Error(`该配置的数据结构版本为 ${schema}，高于当前支持版本 ${(window.FXNAV_APP?.schemaVersion||3)}，请使用更新版本导入`);
    const incoming={
      custom:Array.isArray(d.custom)?d.custom.length:0,
      categories:Array.isArray(d.customCategories)?d.customCategories.length:0,
      favorites:Array.isArray(d.favorites)?d.favorites.length:0,
      hidden:Array.isArray(d.hiddenSites)?d.hiddenSites.length:0,
      siteEdits:d.siteEdits&&typeof d.siteEdits==="object"&&!Array.isArray(d.siteEdits)?Object.keys(d.siteEdits).length:0,
      categoryMoves:d.categoryOverrides&&typeof d.categoryOverrides==="object"&&!Array.isArray(d.categoryOverrides)?Object.keys(d.categoryOverrides).length:0,
      iconOverrides:d.iconOverrides&&typeof d.iconOverrides==="object"&&!Array.isArray(d.iconOverrides)?Object.keys(d.iconOverrides).length:0,
      titleOverrides:d.categoryTitleOverrides&&typeof d.categoryTitleOverrides==="object"&&!Array.isArray(d.categoryTitleOverrides)?Object.keys(d.categoryTitleOverrides).length:0
    };
    const current={custom:state.custom.length,categories:state.customCategories.length,favorites:state.favorites.size,hidden:state.hiddenSites.size,siteEdits:Object.keys(state.siteEdits||{}).length,categoryMoves:Object.keys(state.categoryOverrides||{}).length,iconOverrides:Object.keys(state.iconOverrides||{}).length,titleOverrides:Object.keys(state.categoryTitleOverrides||{}).length};
    const importPreview=[
      "配置导入预览",
      `备份版本：${String(d.appVersion||d.version||"旧版 / 未标记")}`,
      "",
      "项目                    当前 → 导入",
      `自定义网站              ${current.custom} → ${incoming.custom}`,
      `自定义分类              ${current.categories} → ${incoming.categories}`,
      `收藏网站                ${current.favorites} → ${incoming.favorites}`,
      `回收站隐藏              ${current.hidden} → ${incoming.hidden}`,
      `网站信息修改            ${current.siteEdits} → ${incoming.siteEdits}`,
      `网站分类调整            ${current.categoryMoves} → ${incoming.categoryMoves}`,
      `自定义图标覆盖          ${current.iconOverrides} → ${incoming.iconOverrides}`,
      `自定义分类标题          ${current.titleOverrides} → ${incoming.titleOverrides}`,
      "",
      "确认后将替换以上本机个性化配置；保存成功后，网站、分类、收藏等导航数据会按现有同步逻辑提交到 D1。主题与卡片密度仅在备份包含有效值时更新。是否继续？"
    ].join("\n");
    if(!await uiConfirmV1821(importPreview))return;
    const snapshot={custom:cloneJSON(state.custom),recents:[...state.recents],favorites:new Set(state.favorites),categoryOverrides:cloneJSON(state.categoryOverrides),iconOverrides:cloneJSON(state.iconOverrides),hiddenSites:new Set(state.hiddenSites),siteEdits:cloneJSON(state.siteEdits),customCategories:cloneJSON(state.customCategories),categoryOrder:[...state.categoryOrder],categoryIconOverrides:cloneJSON(state.categoryIconOverrides),siteOrder:cloneJSON(state.siteOrder),categoryTitleOverrides:cloneJSON(state.categoryTitleOverrides||{}),duplicateIgnoreKeys:new Set(state.duplicateIgnoreKeys||[])};
    state.custom=Array.isArray(d.custom)?d.custom:[];state.recents=Array.isArray(d.recents)?d.recents:[];state.favorites=new Set(Array.isArray(d.favorites)?d.favorites:[]);state.categoryOverrides=(d.categoryOverrides&&typeof d.categoryOverrides==="object"&&!Array.isArray(d.categoryOverrides))?d.categoryOverrides:{};state.iconOverrides=(d.iconOverrides&&typeof d.iconOverrides==="object"&&!Array.isArray(d.iconOverrides))?d.iconOverrides:{};state.hiddenSites=new Set(Array.isArray(d.hiddenSites)?d.hiddenSites:[]);state.siteEdits=(d.siteEdits&&typeof d.siteEdits==="object"&&!Array.isArray(d.siteEdits))?d.siteEdits:{};state.customCategories=Array.isArray(d.customCategories)?d.customCategories:[];state.categoryOrder=Array.isArray(d.categoryOrder)?d.categoryOrder:[];state.categoryIconOverrides=(d.categoryIconOverrides&&typeof d.categoryIconOverrides==="object"&&!Array.isArray(d.categoryIconOverrides))?d.categoryIconOverrides:{};state.siteOrder=(d.siteOrder&&typeof d.siteOrder==="object"&&!Array.isArray(d.siteOrder))?d.siteOrder:{};state.categoryTitleOverrides=(d.categoryTitleOverrides&&typeof d.categoryTitleOverrides==="object"&&!Array.isArray(d.categoryTitleOverrides))?d.categoryTitleOverrides:{};state.duplicateIgnoreKeys=new Set(Array.isArray(d.duplicateIgnoreKeys)?d.duplicateIgnoreKeys:[]);if(d.usageStats&&typeof d.usageStats==="object"&&!Array.isArray(d.usageStats))STORE.set("fxnav_usage_stats_v157",JSON.stringify(d.usageStats));if(d.density==="compact"||d.density==="comfortable")STORE.set(V157_DENSITY_KEY,d.density);if(["dark","light","liquid","neon","frosted"].includes(d.theme)){STORE.set(KEYS.theme,d.theme);document.documentElement.dataset.theme=d.theme;applyTheme()}applyDensityV157();
    sanitizeState();
    if(!save()){Object.assign(state,{custom:snapshot.custom,recents:snapshot.recents,favorites:snapshot.favorites,categoryOverrides:snapshot.categoryOverrides,iconOverrides:snapshot.iconOverrides,hiddenSites:snapshot.hiddenSites,siteEdits:snapshot.siteEdits,customCategories:snapshot.customCategories,categoryOrder:snapshot.categoryOrder,categoryIconOverrides:snapshot.categoryIconOverrides,siteOrder:snapshot.siteOrder,categoryTitleOverrides:snapshot.categoryTitleOverrides,duplicateIgnoreKeys:snapshot.duplicateIgnoreKeys});throw new Error("导入数据超过浏览器本地存储容量，已恢复原配置")}
    refreshCategoryUI();renderDeletedList();updateStorageUsage();toast(`${window.FXNAV_APP?.build||"V19.27"} 配置已导入`);
  }catch(err){alert(err?.message||"配置文件无效")}finally{e.target.value=""}
});

$("#restoreAllDeletedBtn").onclick=async()=>{
  if(!state.hiddenSites.size)return toast("没有已删除的网站");
  if(!await uiConfirmV1821(`恢复全部 ${state.hiddenSites.size} 个已删除网站？`))return;
  state.hiddenSites.clear();save();buildNav();render();renderCustomList();renderDeletedList();buildMoveSiteOptions();toast("已全部恢复");
};
$("#purgeDeletedCustomBtn").onclick=async()=>{
  const ids=state.custom.filter(s=>state.hiddenSites.has(s.id)).map(s=>s.id);
  if(!ids.length)return toast("没有可清理的自建网站");
  if(!await uiConfirmV1821(`彻底清理 ${ids.length} 个已删除的自建网站？\\n\\n此操作不能在页面内恢复，请先导出配置备份。`))return;
  const set=new Set(ids);
  state.custom=state.custom.filter(s=>!set.has(s.id));
  ids.forEach(id=>{state.hiddenSites.delete(id);delete state.categoryOverrides[id];delete state.iconOverrides[id];delete state.siteEdits[id];state.favorites.delete(id)});
  for(const cat of Object.keys(state.siteOrder))state.siteOrder[cat]=state.siteOrder[cat].filter(id=>!set.has(id));
  state.recents=state.recents.filter(id=>!set.has(id));
  save();buildNav();render();renderCustomList();renderDeletedList();buildMoveSiteOptions();toast("已清理");
};

const toTop=$("#toTop");
toTop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#siteEditorBackdrop")?.classList.contains("show"))closeSiteEditor();
});

/* V15.1 · 单一 RAF 滚动监听
   每个动画帧最多更新一次 UI，避免多个 scroll handler 重复改 class / DOM。 */
let __fxCompactThresholdV171=300;
function refreshCompactThresholdV171(){
  const hero=$("#hero");
  if(hero)__fxCompactThresholdV171=Math.max(180,hero.offsetTop+hero.offsetHeight-72);
}
function getCompactThresholdV171(){return __fxCompactThresholdV171}
refreshCompactThresholdV171();
window.addEventListener("resize",()=>requestAnimationFrame(refreshCompactThresholdV171),{passive:true});

let __fxScrollRAF=0;
let __fxScrollIdleTimer=0;
let __fxToTopVisible=false;

function handleWindowScroll(){
  if(__fxScrollRAF)return;
  __fxScrollRAF=requestAnimationFrame(()=>{
    __fxScrollRAF=0;

    const shouldShowTop=window.scrollY>500;
    if(shouldShowTop!==__fxToTopVisible){
      __fxToTopVisible=shouldShowTop;
      toTop.classList.toggle("show",shouldShowTop);
    }

    const compactBar=$("#compactBar");
    const compactShouldShow=window.scrollY>getCompactThresholdV171();
    if(compactBar){
      compactBar.classList.toggle("show",compactShouldShow);
      compactBar.setAttribute("aria-hidden",compactShouldShow?"false":"true");
    }

    const menu=$("#categoryContext");
    if(menu?.classList.contains("show"))closeCategoryContext();

    if(!document.documentElement.classList.contains("is-scrolling")){
      document.documentElement.classList.add("is-scrolling");
    }

    clearTimeout(__fxScrollIdleTimer);
    __fxScrollIdleTimer=setTimeout(()=>{
      document.documentElement.classList.remove("is-scrolling");
    },140);
  });
}

window.addEventListener("scroll",handleWindowScroll,{passive:true});
window.addEventListener("resize",closeCategoryContext,{passive:true});

/* V17.5 management drawer scroll performance */
const __drawerBodyV171=$("#drawer .drawer-body");
let __drawerIdleV171=0;
if(__drawerBodyV171){
  __drawerBodyV171.addEventListener("scroll",()=>{
    const drawer=$("#drawer");
    if(drawer&&!drawer.classList.contains("is-drawer-scrolling"))drawer.classList.add("is-drawer-scrolling");
    clearTimeout(__drawerIdleV171);
    __drawerIdleV171=setTimeout(()=>drawer?.classList.remove("is-drawer-scrolling"),120);
  },{passive:true});
}


/* V10/V15.1 context menu closing behavior */
document.addEventListener("pointerdown",e=>{
  const menu=$("#categoryContext");
  if(menu?.classList.contains("show")&&!e.target.closest("#categoryContext"))closeCategoryContext();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("#categoryContext")?.classList.contains("show"))closeCategoryContext();
});



/* V15.3 delegated mouse-follow glow */
let __cardGlowRAF=0,__cardGlowTarget=null,__cardGlowClientX=0,__cardGlowClientY=0;
if(window.matchMedia?.("(hover:hover) and (pointer:fine)").matches){
  $("#content").addEventListener("pointermove",e=>{
    const card=e.target.closest(".card");if(!card)return;
    __cardGlowTarget=card;__cardGlowClientX=e.clientX;__cardGlowClientY=e.clientY;
    if(__cardGlowRAF)return;
    __cardGlowRAF=requestAnimationFrame(()=>{
      __cardGlowRAF=0;
      const target=__cardGlowTarget;if(!target)return;
      const r=target.getBoundingClientRect();
      const x=((__cardGlowClientX-r.left)/r.width*100).toFixed(1)+"%";
      const y=((__cardGlowClientY-r.top)/r.height*100).toFixed(1)+"%";
      target.style.setProperty("--mx",x);target.style.setProperty("--my",y);
    });
  },{passive:true});
}

window.addEventListener("resize",()=>requestAnimationFrame(updateNavIndicator),{passive:true});
requestAnimationFrame(()=>{document.body.classList.add("page-ready");renderHeroRecent();syncCompactControls();updateNavIndicator()});


/* ===================== V15.7 · Command Launcher ===================== */
let __commandIndex=0,__commandItems=[];

function launcherScoreSite(site,q){
  const query=q.trim().toLowerCase();
  const usage=getUsageStatsV157()[site.id]||{};
  const recency=state.recents.indexOf(site.id);
  let score=Math.log2((Number(usage.count)||0)+1)*4+(state.favorites.has(site.id)?7:0)+(recency>=0?Math.max(0,8-recency*.35):0);
  if(!query)return score;
  const name=String(site.name||"").toLowerCase();
  const domain=String(site.domain||safeDomain(site.url)||"").toLowerCase();
  const title=String(site.fullTitle||"").toLowerCase();
  const cat=effectiveCategory(site).toLowerCase();
  const tokens=query.split(/\s+/).filter(Boolean);
  if(!tokens.every(t=>(`${name} ${domain} ${title} ${cat}`).includes(t)))return -9999;
  if(name===query)score+=120;
  else if(name.startsWith(query))score+=85;
  else if(name.includes(query))score+=58;
  if(domain.startsWith(query))score+=45;
  else if(domain.includes(query))score+=28;
  if(cat.includes(query))score+=18;
  if(title.includes(query))score+=12;
  return score;
}

function getLauncherResults(q){
  const query=String(q||"").trim();
  const sites=allSites()
    .map(site=>({type:"site",site,score:launcherScoreSite(site,query)}))
    .filter(x=>x.score>-9000)
    .sort((a,b)=>b.score-a.score)
    .slice(0,9);

  const cats=query?allCategories()
    .filter(c=>c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0,3)
    .map(c=>({type:"category",category:c,score:70})):[];
  return [...cats,...sites];
}

function ensureCommandLauncher(){
  if($("#commandBackdrop"))return;
  const shell=document.createElement("div");
  shell.id="commandBackdrop";shell.className="command-backdrop";shell.setAttribute("aria-hidden","true");
  shell.innerHTML=`
    <div class="command-panel" role="dialog" aria-modal="true" aria-label="快速启动">
      <div class="command-search">
        <span class="command-search-symbol">⌕</span>
        <input id="commandInput" autocomplete="off" spellcheck="false" placeholder="搜索网站、分类或域名…" aria-label="快速搜索">
        <span class="command-esc">ESC</span>
      </div>
      <div class="command-body" id="commandBody"></div>
      <div class="command-footer"><span>↑ ↓ 选择</span><span>Enter 打开</span><span>Ctrl / ⌘ + K</span></div>
    </div>`;
  document.body.append(shell);

  shell.addEventListener("pointerdown",e=>{if(e.target===shell)closeCommandLauncher()});
  $("#commandInput").addEventListener("input",e=>renderCommandLauncher(e.target.value));
  $("#commandInput").addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){e.preventDefault();moveCommandSelection(1)}
    else if(e.key==="ArrowUp"){e.preventDefault();moveCommandSelection(-1)}
    else if(e.key==="Enter"){e.preventDefault();activateCommandSelection()}
    else if(e.key==="Escape"){e.preventDefault();closeCommandLauncher()}
  });
}

function renderCommandLauncher(q=""){
  ensureCommandLauncher();
  const body=$("#commandBody");body.innerHTML="";
  __commandItems=getLauncherResults(q);
  __commandIndex=Math.min(__commandIndex,Math.max(0,__commandItems.length-1));

  const groupTitle=document.createElement("div");groupTitle.className="command-group-title";
  groupTitle.textContent=q.trim()?"搜索结果":"常用与最近";
  body.append(groupTitle);

  if(!__commandItems.length){
    const empty=document.createElement("div");empty.className="command-empty";empty.textContent="没有找到匹配的网站或分类";
    body.append(empty);return;
  }

  __commandItems.forEach((item,index)=>{
    const btn=document.createElement("button");btn.type="button";btn.className="command-item"+(index===__commandIndex?" active":"");
    if(item.type==="category"){
      const icon=document.createElement("span");icon.className="section-badge";renderCategoryIcon(icon,item.category.icon||"•");
      const copy=document.createElement("span");copy.className="command-copy";
      const name=document.createElement("span");name.className="command-name";name.textContent=item.category.name;
      const meta=document.createElement("span");meta.className="command-meta";meta.textContent=categoryDescription(item.category.name);
      const kind=document.createElement("span");kind.className="command-kind";kind.textContent="分类";
      copy.append(name,meta);btn.append(icon,copy,kind);
    }else{
      btn.append(createSiteIcon(item.site,"custom-mini-icon"));
      const copy=document.createElement("span");copy.className="command-copy";
      const name=document.createElement("span");name.className="command-name";name.textContent=item.site.name;
      const meta=document.createElement("span");meta.className="command-meta";meta.textContent=`${effectiveCategory(item.site)} · ${item.site.domain||safeDomain(item.site.url)}`;
      const kind=document.createElement("span");kind.className="command-kind";kind.textContent=state.favorites.has(item.site.id)?"★ 收藏":"↗ 打开";
      copy.append(name,meta);btn.append(copy,kind);
    }
    btn.onmouseenter=()=>{__commandIndex=index;refreshCommandActive()};
    btn.onclick=()=>{__commandIndex=index;activateCommandSelection()};
    body.append(btn);
  });
}

function refreshCommandActive(){
  $$("#commandBody .command-item").forEach((el,i)=>el.classList.toggle("active",i===__commandIndex));
  const active=$$("#commandBody .command-item")[__commandIndex];
  active?.scrollIntoView({block:"nearest"});
}
function moveCommandSelection(delta){
  if(!__commandItems.length)return;
  __commandIndex=(__commandIndex+delta+__commandItems.length)%__commandItems.length;
  refreshCommandActive();
}
function activateCommandSelection(){
  const item=__commandItems[__commandIndex];if(!item)return;
  if(item.type==="category"){
    state.filter=item.category.name;state.query="";
    $("#searchInput").value="";$("#compactSearchInput").value="";
    document.body.classList.remove("searching");syncNavActive();render({animate:true});
    closeCommandLauncher();window.scrollTo({top:0,behavior:"smooth"});setTimeout(updateNavIndicator,30);
  }else{
    recordRecent(item.site.id);window.open(item.site.url,"_blank","noopener");closeCommandLauncher();
  }
}
function openCommandLauncher(seed=""){
  ensureCommandLauncher();
  const shell=$("#commandBackdrop"),input=$("#commandInput");
  shell.classList.add("show");shell.setAttribute("aria-hidden","false");
  __commandIndex=0;input.value=seed;renderCommandLauncher(seed);
  setTimeout(()=>{input.focus();input.select()},20);
}
function closeCommandLauncher(){
  const shell=$("#commandBackdrop");if(!shell)return;
  shell.classList.remove("show");shell.setAttribute("aria-hidden","true");
}

function initV157(){
  applyDensityV157();
  ensureCommandLauncher();

  $("#densityBtn")?.addEventListener("click",toggleDensityV157);
  $("#compactDensityBtn")?.addEventListener("click",toggleDensityV157);

  $("#mobileHomeBtn")?.addEventListener("click",()=>{
    state.filter="all";state.query="";$("#searchInput").value="";$("#compactSearchInput").value="";
    syncNavActive();render({animate:true});window.scrollTo({top:0,behavior:"smooth"});
  });
  $("#mobileSearchBtn")?.addEventListener("click",()=>openCommandLauncher(""));
  $("#mobileFavoriteBtn")?.addEventListener("click",()=>{
    state.filter="favorite";state.query="";syncNavActive();render({animate:true});window.scrollTo({top:0,behavior:"smooth"});
  });
  $("#mobileManageBtn")?.addEventListener("click",openDrawer);

  document.addEventListener("keydown",e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
      e.preventDefault();e.stopImmediatePropagation();openCommandLauncher(state.query||"");
    }else if(e.key==="Escape"&&$("#commandBackdrop")?.classList.contains("show")){
      e.preventDefault();e.stopImmediatePropagation();closeCommandLauncher();
    }
  },true);

  scheduleSectionSpy();
  syncMobileBottomBar();
}
initV157();


/* ===================== V15.8 · Sidebar press feedback ===================== */
const __sidebarV158=$("#sidebar");
if(__sidebarV158){
  __sidebarV158.addEventListener("pointerdown",e=>{
    const btn=e.target.closest(".nav-btn");
    if(!btn||e.pointerType==="touch")return;
    btn.classList.add("nav-press");
  });
  ["pointerup","pointercancel","pointerleave"].forEach(type=>{
    __sidebarV158.addEventListener(type,e=>{
      const btn=e.target.closest?.(".nav-btn");
      if(btn)btn.classList.remove("nav-press");
      else $$(".nav-btn.nav-press").forEach(x=>x.classList.remove("nav-press"));
    },{passive:true});
  });
}

/* ===================== V15.8 · Sync Architecture =====================
   V13 数据结构保留。
   这里增加统一同步入口，后端 API 接入后无需重构页面。
*/
const FX_SYNC={
  version:(window.FXNAV_APP?.build||"V19.27"),
  enabled:false,
  user:null,
  endpoint:"",
  getPayload(){
    return {
      version:this.version,
      time:Date.now(),
      favorites:[...state.favorites],
      recents:state.recents,
      custom:state.custom,
      categoryOverrides:state.categoryOverrides,
      iconOverrides:state.iconOverrides,
      hiddenSites:[...state.hiddenSites],
      siteEdits:state.siteEdits,
      customCategories:state.customCategories,
      categoryOrder:state.categoryOrder,
      categoryIconOverrides:state.categoryIconOverrides,
      siteOrder:state.siteOrder
    };
  },
  async push(){
    if(!this.enabled||!this.endpoint)return false;
    return false;
  },
  async pull(){
    if(!this.enabled||!this.endpoint)return false;
    return false;
  }
};


/* ===================== V16.2 · Smart Manager Logic Upgrade ===================== */
(function(){
  function rootDomainFromHost(host){
    const clean=String(host||"").toLowerCase().replace(/^www\./,"").trim();
    if(!clean)return "";
    const parts=clean.split('.').filter(Boolean);
    if(parts.length<=2)return clean;
    const suffix2=parts.slice(-2).join('.');
    const special=new Set(['com.cn','net.cn','org.cn','gov.cn','edu.cn','co.uk','com.hk','com.tw','com.au','co.jp','com.sg']);
    if(special.has(suffix2)&&parts.length>=3)return parts.slice(-3).join('.');
    return parts.slice(-2).join('.');
  }
  function rootDomainFromUrl(url){
    const u=validHttpUrl(url);
    return u?rootDomainFromHost(u.hostname):"";
  }
  function findDuplicateSite(url,excludeId=""){
    const u=validHttpUrl(url);
    if(!u)return null;
    const canon=canonicalUrl(u.href);
    const root=rootDomainFromHost(u.hostname);
    return rawSites().find(site=>{
      if(site.id===excludeId)return false;
      const su=validHttpUrl(site.url);
      if(!su)return false;
      const scanon=canonicalUrl(su.href);
      const sroot=rootDomainFromHost(su.hostname);
      return scanon===canon;
    })||null;
  }
  function duplicateGroups(){
    const exactMap=new Map();
    const rootMap=new Map();
    rawSites().forEach(site=>{
      const u=validHttpUrl(site.url);
      if(!u)return;
      const exact=canonicalUrl(u.href);
      const root=rootDomainFromHost(u.hostname);
      if(!exactMap.has(exact))exactMap.set(exact,[]);
      exactMap.get(exact).push(site);
      if(root){
        if(!rootMap.has(root))rootMap.set(root,[]);
        rootMap.get(root).push(site);
      }
    });
    const groups=[];
    const seen=new Set();
    exactMap.forEach((sites,exact)=>{
      const uniq=[...new Map(sites.map(s=>[s.id,s])).values()];
      if(uniq.length>1){
        const id='url:'+uniq.map(s=>s.id).sort().join('|');
        seen.add(id);
        groups.push({id,label:exact,type:'完全同网址',sites:uniq});
      }
    });
    rootMap.forEach((sites,root)=>{
      const uniq=[...new Map(sites.map(s=>[s.id,s])).values()];
      if(uniq.length>1){
        const id='root:'+uniq.map(s=>s.id).sort().join('|');
        if(seen.has('url:'+uniq.map(s=>s.id).sort().join('|'))){}
        groups.push({id,label:root,type:'同主域名',sites:uniq});
      }
    });
    return groups
      .map(g=>({
        ...g,
        sites:g.sites.slice().sort((a,b)=>siteKeepScore(b)-siteKeepScore(a)||String(a.name).localeCompare(String(b.name),'zh-Hans-CN'))
      }))
      .sort((a,b)=>b.sites.length-a.sites.length||a.type.localeCompare(b.type,'zh-Hans-CN')||a.label.localeCompare(b.label,'zh-Hans-CN'));
  }
  function siteKeepScore(site){
    let score=0;
    if(isBuiltinSite(site.id))score+=80;
    if(state.favorites.has(site.id))score+=40;
    if(!state.hiddenSites.has(site.id))score+=15;
    const recentIndex=state.recents.indexOf(site.id);
    if(recentIndex>=0)score+=Math.max(10-recentIndex,1);
    return score;
  }
  function pickKeepSite(sites){
    return sites.slice().sort((a,b)=>siteKeepScore(b)-siteKeepScore(a)||String(a.name).localeCompare(String(b.name),'zh-Hans-CN'))[0];
  }
  function escapeHtml(str){
    return String(str??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function ensureManagerUpgrades(){
    const drawerBody=document.querySelector('#drawer .drawer-body');
    if(!drawerBody)return;
    const topNote=drawerBody.querySelector('.admin-note');
    if(topNote && !document.getElementById('managerMetrics')){
      const metrics=document.createElement('div');
      metrics.id='managerMetrics';
      metrics.className='manager-metrics';
      topNote.insertAdjacentElement('afterend',metrics);
    }
    if(!document.getElementById('duplicatePanel')){
      const form=document.getElementById('addForm');
      if(form){
        const panel=document.createElement('section');
        panel.id='duplicatePanel';
        panel.className='duplicate-panel';
        panel.innerHTML=`
          <div class="custom-title-row">
            <h3>重复检测</h3>
            <span class="custom-count" id="duplicateCount">0 组</span>
          </div>
          <div class="admin-note">系统会自动按“完整网址”和“主域名”扫描重复项；现在新增或编辑网站时，检测到重复会直接拦截，不允许重复添加。</div>
          <div class="duplicate-toolbar">
            <button class="btn" type="button" id="scanDuplicatesBtn">扫描重复项</button>
            <button class="btn" type="button" id="jumpDeletedBtn">查看已删除网站</button>
          </div>
          <div class="duplicate-list" id="duplicateList"></div>
        `;
        const divider=[...drawerBody.children].find(el=>el.classList && el.classList.contains('admin-divider'));
        if(divider) divider.before(panel);
        else form.insertAdjacentElement('afterend',panel);
      }
    }
    /* V18.7: duplicate scan is handled only by Manager Center. */
    const jumpDeleted=document.getElementById('jumpDeletedBtn');
    if(jumpDeleted&&!jumpDeleted.dataset.boundV17){
      jumpDeleted.dataset.boundV17="1";
      jumpDeleted.addEventListener('click',()=>document.getElementById('deletedList')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
    document.getElementById('addForm')?.classList.add('admin-surface');
    document.getElementById('movePreview')?.classList.add('admin-surface');
    document.getElementById('customList')?.classList.add('admin-surface');
    document.getElementById('deletedList')?.classList.add('admin-surface');
    document.getElementById('categoryManagerList')?.classList.add('admin-surface');
  }
  function renderManagerMetrics(){
    const box=document.getElementById('managerMetrics');
    if(!box)return;
    const visibleCustom=state.custom.filter(site=>!state.hiddenSites.has(site.id)).length;
    const groups=duplicateGroups();
    box.innerHTML=`
      <div class="metric-card"><span><i class="metric-dot"></i>全部网站</span><strong>${allSites().length}</strong></div>
      <div class="metric-card"><span><i class="metric-dot"></i>我的新增</span><strong>${visibleCustom}</strong></div>
      <div class="metric-card"><span><i class="metric-dot"></i>已删除/隐藏</span><strong>${state.hiddenSites.size}</strong></div>
      <div class="metric-card dup"><span><i class="metric-dot"></i>重复分组</span><strong>${groups.length}</strong></div>
    `;
  }
  function renderDuplicateList(){
    ensureManagerUpgrades();
    const box=document.getElementById('duplicateList');
    const count=document.getElementById('duplicateCount');
    if(!box || !count)return;
    const groups=duplicateGroups();
    count.textContent=`${groups.length} 组`;
    if(!groups.length){
      box.innerHTML='<div class="duplicate-empty">当前没有检测到重复网站，管理库很干净。</div>';
      annotateDuplicateRows();
      return;
    }
    box.innerHTML='';
    groups.forEach((group,idx)=>{
      const keep=pickKeepSite(group.sites);
      const wrap=document.createElement('div');
      wrap.className='duplicate-group';
      const head=document.createElement('div');
      head.className='duplicate-group-head';
      head.innerHTML=`
        <div class="duplicate-group-title">
          <strong>${escapeHtml(group.label)}</strong>
          <span class="dup-chip warn">${group.type}</span>
          <span class="dup-chip">${group.sites.length} 个站点</span>
        </div>
        <button class="btn dup-hide-btn" type="button">一键去重</button>
      `;
      head.querySelector('button').addEventListener('click',()=>hideDuplicateGroup(group.id));
      const body=document.createElement('div');
      body.className='duplicate-items';
      group.sites.forEach(site=>{
        const row=document.createElement('div');
        row.className='dup-item';
        const icon=createSiteIcon(site,'custom-mini-icon');
        const copy=document.createElement('div');
        copy.className='dup-item-copy';
        const domain=site.domain||safeDomain(site.url)||rootDomainFromUrl(site.url);
        copy.innerHTML=`<b>${escapeHtml(site.name)}</b><small>${escapeHtml(effectiveCategory(site))} · ${escapeHtml(domain)}</small>`;
        const meta=document.createElement('div');
        meta.className='dup-meta';
        const source=document.createElement('span');
        source.className='dup-chip'+(site.id===keep.id?' dup-keep':'');
        source.textContent=site.id===keep.id?'建议保留':(isBuiltinSite(site.id)?'内置网站':'自建网站');
        if(site.id!==keep.id && isBuiltinSite(site.id))source.textContent='内置网站';
        const hidden=document.createElement('span');
        hidden.className='dup-chip';
        hidden.textContent=state.hiddenSites.has(site.id)?'已隐藏':'显示中';
        meta.append(source,hidden);
        row.append(icon,copy,meta);
        body.append(row);
      });
      wrap.append(head,body);
      box.append(wrap);
    });
    annotateDuplicateRows();
  }
  async function hideDuplicateGroup(groupId){
    const group=duplicateGroups().find(item=>item.id===groupId);
    if(!group)return;
    const keep=pickKeepSite(group.sites);
    const targets=group.sites.filter(site=>site.id!==keep.id);
    if(!targets.length)return toast('该分组没有可处理的重复项');
    if(!await uiConfirmV1821(`检测到 ${group.sites.length} 个重复网站。\n\n将保留「${keep.name}」，并把其余 ${targets.length} 个站点移入“已删除网站/隐藏列表”。\n\n是否继续？`))return;
    targets.forEach(site=>{
      state.hiddenSites.add(site.id);
      state.favorites.delete(site.id);
      state.recents=state.recents.filter(id=>id!==site.id);
    });
    if(!save())return;
    buildNav();
    render();
    renderCustomList();
    renderDeletedList();
    buildMoveSiteOptions();
    renderDuplicateList();
    renderManagerMetrics();
    toast(`已保留「${keep.name}」，隐藏 ${targets.length} 个重复项`);
  }
  function annotateDuplicateRows(){
    const groups=duplicateGroups();
    const dupIds=new Set(groups.flatMap(g=>g.sites.map(s=>s.id)));
    document.querySelectorAll('#customList .custom-item').forEach(row=>{
      row.querySelectorAll('.duplicate-badge').forEach(x=>x.remove());
      const nameEl=row.querySelector('.custom-grow b');
      const small=row.querySelector('.custom-grow small');
      if(!nameEl || !small)return;
      const siteName=nameEl.textContent.trim();
      const domainText=small.textContent||'';
      const site=state.custom.find(s=>s.name===siteName && domainText.includes((s.domain||safeDomain(s.url)||'')));
      if(site && dupIds.has(site.id)){
        const badge=document.createElement('span');
        badge.className='duplicate-badge';
        badge.textContent='重复项';
        nameEl.append(badge);
      }
    });
  }
  function validateUniquenessInput(input,excludeId=""){
    if(!input)return;
    const url=input.value.trim();
    if(!url){input.setCustomValidity('');return;}
    const dup=findDuplicateSite(url,excludeId);
    if(dup){
      const domain=dup.domain||safeDomain(dup.url)||rootDomainFromUrl(dup.url);
      input.setCustomValidity(`检测到重复网站：${dup.name}（${domain}）`);
      input.reportValidity();
    }else input.setCustomValidity('');
  }
  document.getElementById('addForm')?.addEventListener('submit',e=>{
    const url=document.getElementById('newUrl')?.value?.trim()||'';
    const dup=findDuplicateSite(url,'');
    if(dup){
      e.preventDefault();
      e.stopImmediatePropagation();
      alert(`检测到重复网站：${dup.name}\n\n为避免重复收录，这次添加已被拦截。\n如确实需要，请先编辑原站点或删除旧站点后再添加。`);
      return false;
    }
  },true);

  const _origSaveSiteEditor=saveSiteEditor;
  saveSiteEditor=async function(){
    const current=rawSites().find(s=>s.id===editingSiteId);
    const editUrl=document.getElementById('editSiteUrl')?.value?.trim()||'';
    const dup=findDuplicateSite(editUrl,current?.id||'');
    if(dup){
      alert(`检测到重复网站：${dup.name}\n\n当前保存已拦截，请不要把网址改成重复条目。`);
      return;
    }
    return _origSaveSiteEditor();
  };
  document.getElementById('saveSiteEditor').onclick=saveSiteEditor;

  const _origOpenDrawer=openDrawer;
  openDrawer=function(){
    _origOpenDrawer();
    if(!document.getElementById("managerTabs")){
      ensureManagerUpgrades();
      renderManagerMetrics();
    }
  };
  document.getElementById('manageBtn').onclick=openDrawer;
  document.getElementById('compactManageBtn').onclick=openDrawer;
  document.getElementById('mobileManageBtn')?.addEventListener('click',()=>setTimeout(()=>{ensureManagerUpgrades();renderManagerMetrics()},50));

  const _origUpdateCounts=updateCounts;
  updateCounts=function(){
    _origUpdateCounts();
    renderManagerMetrics();
  };

  const _origRenderCustomList=renderCustomList;
  renderCustomList=function(){
    _origRenderCustomList();
    annotateDuplicateRows();renderManagerMetrics();
  };
  const _origRenderDeletedList=renderDeletedList;
  renderDeletedList=function(){
    _origRenderDeletedList();
    renderManagerMetrics();
  };

  document.getElementById('newUrl')?.addEventListener('blur',()=>validateUniquenessInput(document.getElementById('newUrl')));
  document.getElementById('newUrl')?.addEventListener('input',()=>validateUniquenessInput(document.getElementById('newUrl')));
  document.getElementById('editSiteUrl')?.addEventListener('blur',()=>validateUniquenessInput(document.getElementById('editSiteUrl'),editingSiteId||''));
  document.getElementById('editSiteUrl')?.addEventListener('input',()=>validateUniquenessInput(document.getElementById('editSiteUrl'),editingSiteId||''));

  ensureManagerUpgrades();
  renderManagerMetrics();
})();


/* V17 must own the save scheduler after legacy runtime definitions. */
window.__fxCloudSchedulePush=scheduleDataSyncV17;


/* ===================== V17.5 · Smooth UX Runtime ===================== */
(function(){
  const root=document.documentElement;
  const body=document.body;
  let overlayDepth=0;
  function lockOverlay(){
    overlayDepth++;
    body.classList.add("ui-overlay-open");
  }
  function unlockOverlay(){
    overlayDepth=Math.max(0,overlayDepth-1);
    if(!overlayDepth)body.classList.remove("ui-overlay-open");
  }

  const oldOpenDrawer=openDrawer, oldCloseDrawer=closeDrawer;
  openDrawer=function(){
    if(!$("#drawer")?.classList.contains("show"))lockOverlay();
    oldOpenDrawer();
    requestAnimationFrame(()=>$("#drawer")?.classList.add("motion-ready"));
  };
  closeDrawer=function(){
    const wasOpen=$("#drawer")?.classList.contains("show");
    oldCloseDrawer();
    if(wasOpen)unlockOverlay();
  };
  $("#manageBtn").onclick=openDrawer;
  $("#compactManageBtn").onclick=openDrawer;
  $("#closeDrawer").onclick=closeDrawer;
  $("#backdrop").onclick=closeDrawer;

  const oldOpenEditor=openSiteEditor, oldCloseEditor=closeSiteEditor;
  openSiteEditor=function(siteOrId){
    if(!$("#siteEditorBackdrop")?.classList.contains("show"))lockOverlay();
    oldOpenEditor(siteOrId);
  };
  closeSiteEditor=function(){
    const wasOpen=$("#siteEditorBackdrop")?.classList.contains("show");
    oldCloseEditor();
    if(wasOpen)unlockOverlay();
  };
  $("#saveSiteEditor").onclick=saveSiteEditor;
  $("#closeSiteEditor").onclick=closeSiteEditor;

  const oldOpenCommand=openCommandLauncher, oldCloseCommand=closeCommandLauncher;
  openCommandLauncher=function(seed=""){
    if(!$("#commandBackdrop")?.classList.contains("show"))lockOverlay();
    oldOpenCommand(seed);
  };
  closeCommandLauncher=function(){
    const wasOpen=$("#commandBackdrop")?.classList.contains("show");
    oldCloseCommand();
    if(wasOpen)unlockOverlay();
  };

  // V18.8：悬浮菜单关闭统一由主 RAF scroll handler 处理。

  // iOS / 高刷新屏上减少第一次 overlay 出现时的布局跳动。
  requestAnimationFrame(()=>body.classList.add("motion-system-ready"));
})();


/* ===================== V17.7 · Context menu runtime guard ===================== */
(function(){
  const menu=document.getElementById('categoryContext');
  if(!menu)return;
  const normalizeContextIcon=()=>{
    const box=menu.querySelector('.context-head-icon');
    if(!box)return;
    box.style.position='relative';
    box.style.overflow='hidden';
    box.querySelectorAll('.site-fallback').forEach(el=>{
      el.style.position='absolute';
      el.style.inset='0';
    });
    box.querySelectorAll('img').forEach(img=>{
      img.style.position='absolute';
      img.style.left='50%';
      img.style.top='50%';
      img.style.transform='translate(-50%,-50%)';
      img.style.width='26px';
      img.style.height='26px';
      img.style.maxWidth='26px';
      img.style.maxHeight='26px';
      img.style.objectFit='contain';
    });
  };
  new MutationObserver(normalizeContextIcon).observe(menu,{childList:true,subtree:true});
})();



/* ===================== V17.15 · Public View / Admin Mode Runtime ===================== */
const GUEST_FAVORITES_KEY_V178="fxnav_guest_favorites_v178";
const GUEST_RECENTS_KEY_V178="fxnav_guest_recents_v178";
let ADMIN_PENDING_V178=null;

function guestFavoritesV178(){const v=parseStored(GUEST_FAVORITES_KEY_V178,[]);return new Set(Array.isArray(v)?v:[])}
function guestRecentsV178(){const v=parseStored(GUEST_RECENTS_KEY_V178,[]);return Array.isArray(v)?v.slice(0,30):[]}
function saveGuestStateV178(){
  STORE.set(GUEST_FAVORITES_KEY_V178,JSON.stringify([...state.favorites]));
  STORE.set(GUEST_RECENTS_KEY_V178,JSON.stringify(state.recents.slice(0,30)));
  if($("#drawer")?.classList.contains("show"))updateStorageUsage();
  return true;
}
function updateAccessUIV178(){
  const admin=!!AUTH_V161.authenticated;
  document.body.classList.toggle("admin-mode",admin);
  document.body.classList.toggle("guest-mode",!admin);
  const accessText=$("#accessModeText");if(accessText)accessText.textContent=admin?"管理员 · 云端可编辑":"访客 · 只读模式";
  const manage=$("#manageBtn");
  if(manage){
    const glyph=manage.querySelector(".tool-glyph"),copy=manage.querySelector("span:last-child");
    if(glyph)glyph.textContent=admin?"＋":"⌁";
    if(copy)copy.textContent="管理导航";
    manage.title=admin?"打开管理导航":"管理员登录后管理导航";
  }
  const compact=$("#compactManageBtn");if(compact){compact.textContent=admin?"＋":"⌁";compact.title=admin?"管理导航":"管理员登录后管理导航"}
  const logout=$("#logoutBtn");if(logout)logout.hidden=!admin;
  if(admin)setCloudStatus("synced","D1 已同步","管理员模式 · Cloudflare D1 SQLite 可读写 · KV 图标可上传");
  else setCloudStatus("synced","访客只读","无需登录即可浏览；修改操作仅管理员可用");
}
function closeLoginGateV178(){
  if(AUTH_V161.authenticated){hideLoginGateV161();updateAccessUIV178();return}
  ADMIN_PENDING_V178=null;
  hideLoginGateV161();
  updateAccessUIV178();
}
function requestAdminV178(action,message="管理员登录后可继续此操作。"){
  if(AUTH_V161.authenticated){action?.();return true}
  ADMIN_PENDING_V178=typeof action==="function"?action:null;
  showLoginGateV161(message);
  const btn=$("#loginSubmit");if(btn)btn.textContent="登录管理";
  return false;
}
async function silentAuthCheckV178(){
  AUTH_V161.checking=true;
  try{
    const result=await authFetchV161("me");
    AUTH_V161.authenticated=!!result.authenticated;
    AUTH_V161.username=result.username||"";
  }catch(err){
    AUTH_V161.authenticated=false;
    AUTH_V161.username="";
  }finally{AUTH_V161.checking=false}
  updateAccessUIV178();
  return AUTH_V161.authenticated;
}
async function initPublicAdminV178(){
  setCloudStatus("syncing","载入导航…","正在读取公开导航数据");
  await silentAuthCheckV178();
  await initDataDrivenV17();
  updateAccessUIV178();
}

// Guest state stays local; admin state keeps syncing to D1.
const __saveBeforeV178=save;
save=function(){
  if(!AUTH_V161.authenticated)return saveGuestStateV178();
  return __saveBeforeV178();
};
const __scheduleDataSyncBeforeV178=scheduleDataSyncV17;
scheduleDataSyncV17=function(){
  if(!AUTH_V161.authenticated){saveGuestStateV178();updateAccessUIV178();return}
  return __scheduleDataSyncBeforeV178();
};
window.__fxCloudSchedulePush=scheduleDataSyncV17;

// Keep guest favorites / recents private to that browser.
const __applyBootstrapBeforeV178=applyBootstrapV17;
applyBootstrapV17=function(payload,opts={}){
  const isGuest=payload?.access==="guest"||payload?.authenticated===false;
  const fav=isGuest?(STORE.get(GUEST_FAVORITES_KEY_V178)===null?new Set(state.favorites):guestFavoritesV178()):null;
  const rec=isGuest?(STORE.get(GUEST_RECENTS_KEY_V178)===null?state.recents.slice(0,30):guestRecentsV178()):null;
  const ok=__applyBootstrapBeforeV178(payload,opts);
  if(!ok)return ok;
  AUTH_V161.authenticated=!isGuest;
  if(isGuest){
    const ids=new Set(rawSites().map(s=>s.id));
    state.favorites=new Set([...fav].filter(id=>ids.has(id)));
    state.recents=rec.filter(id=>ids.has(id)).slice(0,30);
    state.hiddenSites=new Set();
    buildNav();render();updateCounts();
  }
  updateAccessUIV178();
  return ok;
};

// Login now only elevates permissions; public page remains visible without it.
const __doLoginBeforeV178=doLoginV161;
doLoginV161=async function(username,password){
  const ok=await __doLoginBeforeV178(username,password);
  if(ok){
    updateAccessUIV178();
    const pending=ADMIN_PENDING_V178;ADMIN_PENDING_V178=null;
    if(pending)setTimeout(()=>pending(),60);
  }
  const btn=$("#loginSubmit");if(btn&&!btn.disabled)btn.textContent="登录管理";
  return ok;
};
logoutV161=async function(){
  try{await authFetchV161("logout","POST",{})}catch{}
  AUTH_V161.authenticated=false;AUTH_V161.username="";V17.ready=false;
  clearTimeout(V17.pushTimer);closeDrawer();closeCategoryContext();closeSiteEditor();
  hideLoginGateV161();
  await refreshV17FromServer({quiet:true});
  updateAccessUIV178();
  toast("已退出管理员模式，当前为访客只读");
};

$("#closeLoginGate")?.addEventListener("click",closeLoginGateV178);
$("#loginGate")?.addEventListener("pointerdown",e=>{if(e.target===$("#loginGate"))closeLoginGateV178()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#loginGate")?.classList.contains("show")&&!AUTH_V161.authenticated){e.preventDefault();closeLoginGateV178()}},true);

// Admin-only entry points.
const __openDrawerBeforeV178=openDrawer;
openDrawer=function(){return requestAdminV178(()=>__openDrawerBeforeV178(),"管理导航仅管理员可用，请登录后继续。")};
const __toggleSortBeforeV178=toggleSortMode;
toggleSortMode=function(){return requestAdminV178(()=>__toggleSortBeforeV178(),"排序会修改云端导航，请先登录管理员。")};
const __openEditorBeforeV178=openSiteEditor;
openSiteEditor=function(siteOrId){return requestAdminV178(()=>__openEditorBeforeV178(siteOrId),"编辑网站需要管理员权限。")};
const __chooseIconBeforeV178=chooseContextIcon;
chooseContextIcon=function(site){return requestAdminV178(()=>__chooseIconBeforeV178(site),"上传或修改 Logo 需要管理员权限。")};
const __deleteContextBeforeV178=deleteContextSite;
deleteContextSite=function(site){return requestAdminV178(()=>__deleteContextBeforeV178(site),"删除网站需要管理员权限。")};
const __applyCategoryBeforeV178=applyContextCategory;
applyContextCategory=function(site,target){return requestAdminV178(()=>__applyCategoryBeforeV178(site,target),"移动分类需要管理员权限。")};
const __restoreCategoryBeforeV178=restoreContextCategory;
restoreContextCategory=function(site){return requestAdminV178(()=>__restoreCategoryBeforeV178(site),"恢复分类需要管理员权限。")};
const __resetIconBeforeV178=resetContextIcon;
resetContextIcon=function(site){return requestAdminV178(()=>__resetIconBeforeV178(site),"恢复图标需要管理员权限。")};

$("#manageBtn").onclick=openDrawer;
$("#compactManageBtn").onclick=openDrawer;
$("#sortModeBtn").onclick=toggleSortMode;
$("#compactSortBtn").onclick=toggleSortMode;
$("#logoutBtn")?.addEventListener("click",async e=>{e.preventDefault();e.stopImmediatePropagation();if(AUTH_V161.authenticated&&await uiConfirmV1821("退出管理员模式？"))logoutV161()},true);
$("#mobileManageBtn")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();openDrawer()},true);

// Guest right-click menu: browse / local favorite / copy only. Admin gets full original menu.
const __buildContextBeforeV178=buildCategoryContext;
buildCategoryContext=function(site){
  if(AUTH_V161.authenticated)return __buildContextBeforeV178(site);
  const menu=$("#categoryContext");menu.innerHTML="";
  const head=document.createElement("div");head.className="context-head";
  const iconWrap=createContextHeadIconV187(site);
  const copy=document.createElement("div");copy.className="context-head-copy";
  const name=document.createElement("div");name.className="context-head-name";name.textContent=site.name;
  const cat=document.createElement("div");cat.className="context-head-category";cat.textContent=`${contextCategoryLabelV187(effectiveCategory(site))} · 访客只读`;
  copy.append(name,cat);head.append(iconWrap,copy);
  const tools=document.createElement("div");tools.className="context-tools";
  const openBtn=document.createElement("button");openBtn.type="button";openBtn.className="context-tool full";openBtn.innerHTML='<span class="context-tool-icon">↗</span><span>打开网站</span>';openBtn.onclick=e=>{e.preventDefault();e.stopPropagation();recordRecent(site.id);closeCategoryContext();window.open(site.url,"_blank","noopener")};
  const favBtn=document.createElement("button");favBtn.type="button";favBtn.className="context-tool";favBtn.innerHTML=`<span class="context-tool-icon">${state.favorites.has(site.id)?"★":"☆"}</span><span>${state.favorites.has(site.id)?"取消本机收藏":"收藏到本机"}</span>`;favBtn.onclick=e=>{e.preventDefault();e.stopPropagation();toggleFavorite(site.id);buildCategoryContext(site)};
  const copyBtn=document.createElement("button");copyBtn.type="button";copyBtn.className="context-tool";copyBtn.innerHTML='<span class="context-tool-icon">⧉</span><span>复制网址</span>';copyBtn.onclick=async e=>{e.preventDefault();e.stopPropagation();try{await navigator.clipboard.writeText(site.url);closeCategoryContext();toast("网址已复制")}catch{await uiPromptV1821("复制网址",site.url)}};
  const adminBtn=document.createElement("button");adminBtn.type="button";adminBtn.className="context-tool full admin-login";adminBtn.innerHTML='<span class="context-tool-icon">⌁</span><span>管理员登录后编辑 / 换图标 / 删除</span>';adminBtn.onclick=e=>{e.preventDefault();e.stopPropagation();const r=menu.getBoundingClientRect();closeCategoryContext();requestAdminV178(()=>{__buildContextBeforeV178(site);menu.setAttribute("aria-hidden","false");positionCategoryContext(menu,Math.min(innerWidth-20,r.left+20),Math.min(innerHeight-20,r.top+20))},"登录管理员后可编辑网站、移动分类、自定义 Logo 和删除。")};
  const note=document.createElement("div");note.className="context-guest-note";note.textContent="访客只能浏览、复制和在本机收藏；所有云端修改接口均需要管理员会话。";
  tools.append(openBtn,favBtn,copyBtn,adminBtn);menu.append(head,tools,note);
};

// If an admin session expires during a write, show login only then.
const __pushBeforeV178=pushV17;
pushV17=async function(opts={}){
  if(!AUTH_V161.authenticated)return true;
  return __pushBeforeV178(opts);
};

// Prevent guest mutation through forms if a stale drawer somehow remains open.
document.getElementById("addForm")?.addEventListener("submit",e=>{if(!AUTH_V161.authenticated){e.preventDefault();e.stopImmediatePropagation();requestAdminV178(()=>openDrawer(),"添加网站需要管理员权限。");}},true);

updateAccessUIV178();

