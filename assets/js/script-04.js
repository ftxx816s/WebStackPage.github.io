
/* ===================== V18.7 · Manager Center Runtime ===================== */
(function(){
  const MGR_TAB_KEY="fxnav_manager_tab_v18";
  const CAT_TITLE_KEY="fxnav_category_title_overrides_v18";
  const DUP_IGNORE_KEY="fxnav_duplicate_ignore_v181";
  const PAGE_SIZE=48;
  let managerPageSize=PAGE_SIZE;
  let managerSelection=new Set();
  let managerHealth=new Map();
  let managerReady=false;
  let duplicateScanned=false;

  function v18RootDomain(host){
    const h=String(host||"").toLowerCase().replace(/^www\./,"").replace(/\.$/,"");
    if(!h)return "";
    const parts=h.split(".").filter(Boolean);
    if(parts.length<=2)return h;
    const multipart=new Set([
      "com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn",
      "co.uk","org.uk","gov.uk","ac.uk","com.au","net.au","org.au",
      "co.jp","ne.jp","or.jp","com.hk","com.tw","com.sg","com.br"
    ]);
    const last2=parts.slice(-2).join(".");
    const last3=parts.slice(-3).join(".");
    return multipart.has(last2)?last3:last2;
  }
  function v18UrlMeta(url){
    try{
      const u=new URL(String(url||"").trim());
      return {
        href:u.href,
        host:u.hostname.toLowerCase().replace(/^www\./,""),
        root:v18RootDomain(u.hostname),
        canonical:(u.protocol+"//"+u.hostname.toLowerCase().replace(/^www\./,"")+u.pathname.replace(/\/+$/,"")+(u.search||"")).replace(/\/$/,"")
      };
    }catch{return {href:"",host:"",root:"",canonical:""}}
  }
  function displayCategory(name){
    const raw=String(name||"");
    return String(state.categoryTitleOverrides?.[raw]||raw).trim()||raw;
  }
  window.categoryDisplayNameV18=displayCategory;

  function loadCategoryTitles(){
    const stored=parseStored(CAT_TITLE_KEY,{});
    state.categoryTitleOverrides=(stored&&typeof stored==="object"&&!Array.isArray(stored))?stored:{};
  }
  loadCategoryTitles();
  const storedDupIgnore=parseStored(DUP_IGNORE_KEY,[]);
  state.duplicateIgnoreKeys=new Set(Array.isArray(storedDupIgnore)?storedDupIgnore:[]);
  function saveDuplicateIgnoreLocal(){
    STORE.set(DUP_IGNORE_KEY,JSON.stringify([...state.duplicateIgnoreKeys]));
  }

  function saveCategoryTitlesLocal(){
    STORE.set(CAT_TITLE_KEY,JSON.stringify(state.categoryTitleOverrides||{}));
  }

  // D1 sync: category titles are public-safe UI metadata.
  const __makeV17SnapshotV18=makeV17Snapshot;
  makeV17Snapshot=function(){
    const snap=__makeV17SnapshotV18();
    snap.settings={
      ...(snap.settings||{}),
      categoryTitles:{...(state.categoryTitleOverrides||{})},
      duplicateIgnoreKeys:[...state.duplicateIgnoreKeys]
    };
    return snap;
  };
  const __applyBootstrapV18=applyBootstrapV17;
  applyBootstrapV17=function(payload,opts={}){
    const ok=__applyBootstrapV18(payload,opts);
    if(!ok)return ok;
    const titles=payload?.settings?.categoryTitles;
    if(titles&&typeof titles==="object"&&!Array.isArray(titles)){
      state.categoryTitleOverrides={...titles};
      saveCategoryTitlesLocal();
    }else if(!AUTH_V161?.authenticated){
      state.categoryTitleOverrides={};
    }
    if(AUTH_V161?.authenticated){
      const ignored=payload?.settings?.duplicateIgnoreKeys;
      state.duplicateIgnoreKeys=new Set(Array.isArray(ignored)?ignored:[]);
      saveDuplicateIgnoreLocal();
    }
    refreshCategoryDisplayV18();
    return ok;
  };

  function patchCategoryLabels(){
    document.querySelectorAll(".nav-btn[data-filter] .nav-name").forEach(el=>{
      const btn=el.closest(".nav-btn");
      const key=btn?.dataset.filter;
      if(key && !["all","favorite","recent"].includes(key))el.textContent=displayCategory(key);
    });
    document.querySelectorAll(".section[data-category]").forEach(sec=>{
      const key=sec.dataset.category;
      const h=sec.querySelector(".section-heading-line h2");
      if(h&&key)h.textContent=displayCategory(key);
    });
    document.querySelectorAll("#newCategory option,#moveCategorySelect option,#editSiteCategory option,#managerCategoryFilter option,#managerBatchCategory option").forEach(o=>{
      if(o.value)o.textContent=displayCategory(o.value);
    });
  }
  function refreshCategoryDisplayV18(){
    patchCategoryLabels();
    if(document.getElementById("categoryManagerList"))renderCategoryManager?.();
    if(document.getElementById("managerSiteList"))renderManagerSites();
  }

  const __buildNavV18=buildNav;
  buildNav=function(){const r=__buildNavV18();patchCategoryLabels();return r};
  const __renderV18=render;
  render=function(opts={}){const r=__renderV18(opts);patchCategoryLabels();return r};
  const __fillCategorySelectV18=fillCategorySelect;
  fillCategorySelect=function(sel,current=""){
    const r=__fillCategorySelectV18(sel,current);
    if(sel)[...sel.options].forEach(o=>{if(o.value)o.textContent=displayCategory(o.value)});
    return r;
  };

  // Category manager: one unified display-name action for built-in and custom categories.
  // Removes duplicate custom-category rename UI without changing D1 grouping keys.
  const __renderCategoryManagerV18=renderCategoryManager;
  renderCategoryManager=function(){
    const r=__renderCategoryManagerV18();
    document.querySelectorAll("#categoryManagerList .category-manager-item").forEach(row=>{
      const key=row.dataset.category;
      if(!key)return;
      const copy=row.querySelector(".category-manager-copy");
      const b=copy?.querySelector("b");
      if(b)b.textContent=displayCategory(key);
      if(copy){
        let sub=copy.querySelector(".category-display-sub");
        if(!sub){
          sub=document.createElement("span");
          sub.className="category-display-sub";
          copy.append(sub);
        }
        const custom=displayCategory(key)!==key;
        sub.classList.toggle("is-custom-title",custom);
        sub.textContent=custom?`内部分类键：${key}`:"标题与内部分类键一致";
      }
      const actions=row.querySelector(".category-manager-actions");
      if(actions&&!actions.querySelector(".manager-category-title-btn")){
        const btn=document.createElement("button");
        btn.type="button";
        btn.className="cat-mini manager-category-title-btn";
        btn.textContent="改名";
        btn.title="修改分类显示名称（不更改内部分类键和网站归属）";
        btn.onclick=async()=>{
          const current=displayCategory(key);
          const next=await uiPromptV1821(`自定义分类标题\n\n内部分类：${key}\n留空或输入原名称可恢复默认标题。`,current);
          if(next===null)return;
          const clean=String(next).trim().slice(0,28);
          if(!clean||clean===key)delete state.categoryTitleOverrides[key];
          else state.categoryTitleOverrides[key]=clean;
          saveCategoryTitlesLocal();
          save();
          buildNav();
          render();
          renderCategoryManager();
          buildCategorySelect();
          buildMoveCategorySelect();
          buildMoveSiteOptions();
          renderManagerSites();
          toast(clean&&clean!==key?`分类标题已改为「${clean}」`:"分类标题已恢复默认");
        };
        actions.prepend(btn);
      }
    });
    patchCategoryLabels();
    return r;
  };

  function findTitleRow(text){
    return [...document.querySelectorAll("#drawer .custom-title-row")].find(row=>row.querySelector("h3")?.textContent.trim()===text)||null;
  }
  function moveBlockFromTitle(titleText,panel,stopTitleText){
    const start=findTitleRow(titleText);
    if(!start)return;
    let node=start;
    while(node){
      const next=node.nextElementSibling;
      if(node!==start && node.classList?.contains("custom-title-row") && node.querySelector("h3")?.textContent.trim()===stopTitleText)break;
      if(node.classList?.contains("admin-divider")){node.remove();break}
      panel.append(node);
      node=next;
    }
  }

  function setTab(tab){
    const tabs=[...document.querySelectorAll(".manager-tab")];
    if(!tabs.some(x=>x.dataset.tab===tab))tab="overview";
    STORE.set(MGR_TAB_KEY,tab);
    tabs.forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
    document.querySelectorAll(".manager-panel").forEach(p=>p.classList.toggle("active",p.dataset.panel===tab));
    const body=document.querySelector("#drawer .drawer-body");
    if(body)body.scrollTop=0;
    if(tab==="sites"){rebuildManagerCategorySelects();renderManagerSites()}
    if(tab==="categories"){renderCategoryManager();patchCategoryLabels()}
    if(tab==="recycle")renderDeletedList();
    if(tab==="data")renderDataPanel();
    updateManagerBadges();
  }
  window.setManagerTabV18=setTab;

  function updateManagerBadges(){
    const values={
      sites:allSites().length,
      categories:allCategories().length,
      recycle:state.hiddenSites.size
    };
    for(const [tab,val] of Object.entries(values)){
      const b=document.querySelector(`.manager-tab[data-tab="${tab}"] .manager-tab-badge`);
      if(b)b.textContent=val;
    }
    const d=document.querySelector('.manager-tab[data-tab="duplicates"] .manager-tab-badge');
    if(d)d.textContent=duplicateScanned?document.querySelectorAll("#duplicateList .duplicate-group").length:"·";
  }

  function makePanel(id){
    const p=document.createElement("section");
    p.className="manager-panel";
    p.dataset.panel=id;
    return p;
  }

  function setupManagerCenter(){
    if(managerReady)return;
    const drawer=document.getElementById("drawer");
    const head=drawer?.querySelector(".drawer-head");
    const body=drawer?.querySelector(".drawer-body");
    if(!head||!body)return;

    const tabs=document.createElement("div");
    tabs.id="managerTabs";
    tabs.className="manager-tabs";
    tabs.innerHTML=`
      <button class="manager-tab" type="button" data-tab="overview">概览</button>
      <button class="manager-tab" type="button" data-tab="sites">网站 <span class="manager-tab-badge">0</span></button>
      <button class="manager-tab" type="button" data-tab="categories">分类 <span class="manager-tab-badge">0</span></button>
      <button class="manager-tab" type="button" data-tab="duplicates">重复检测 <span class="manager-tab-badge">·</span></button>
      <button class="manager-tab" type="button" data-tab="recycle">回收站 <span class="manager-tab-badge">0</span></button>
      <button class="manager-tab" type="button" data-tab="data">数据</button>
    `;
    head.append(tabs);

    const overview=makePanel("overview");
    const sites=makePanel("sites");
    const categories=makePanel("categories");
    const duplicates=makePanel("duplicates");
    const recycle=makePanel("recycle");
    const data=makePanel("data");
    const stash=document.createElement("div");
    stash.className="manager-stash";

    // Overview
    const firstNote=body.querySelector(":scope > .admin-note");
    const metrics=document.getElementById("managerMetrics");
    overview.innerHTML=`
      <div class="manager-overview-hero">
        <strong>导航管理中心</strong>
        <p>功能按任务拆分，不再需要在一个超长页面里来回滚动。网站、分类、重复项、回收站和数据工具各自独立。</p>
      </div>
      <div class="manager-quick-grid">
        <button class="manager-quick" type="button" data-go="sites" data-add="1"><b>＋ 新增网站</b><small>添加网站与自定义 Logo</small></button>
        <button class="manager-quick" type="button" data-go="duplicates" data-scan="1"><b>扫描重复</b><small>三级重复检测 + 忽略规则</small></button>
        <button class="manager-quick" type="button" data-go="health"><b>网站体检</b><small>两轮检测 · 直连 / VPN / 疑似失效</small></button>
        <button class="manager-quick" type="button" data-go="categories"><b>分类设置</b><small>标题、图标、排序与移动</small></button>
        <button class="manager-quick" type="button" data-go="data"><b>数据与备份</b><small>D1 / KV / 导入导出</small></button>
      </div>
      <div class="manager-overview-dashboard" id="managerOverviewDashboard" aria-live="polite"></div>
    `;
    if(metrics)overview.insertBefore(metrics,overview.querySelector(".manager-quick-grid"));
    if(firstNote)overview.append(firstNote);

    // Sites
    sites.innerHTML=`
      <div class="manager-panel-title">
        <div><h3>网站管理</h3><p>搜索、筛选、批量移动、批量删除。列表按需渲染，避免一次生成全部 DOM。</p></div>
      </div>
      <div class="manager-site-toolbar">
        <input id="managerSiteSearch" placeholder="搜索名称、域名或分类">
        <select id="managerCategoryFilter"><option value="">全部分类</option></select>
        <button class="btn primary" type="button" id="managerToggleAdd">＋ 新增网站</button>
      </div>
      <div class="manager-add-wrap" id="managerAddWrap"></div>
      <div class="manager-site-list" id="managerSiteList"></div>
      <button class="btn manager-load-more" type="button" id="managerLoadMore" hidden>显示更多</button>
      <div class="manager-batch-bar" id="managerBatchBar">
        <span class="manager-batch-count" id="managerBatchCount">已选 0 项</span>
        <select id="managerBatchCategory"></select>
        <button class="btn" type="button" id="managerBatchMove">批量移动</button>
        <button class="btn" type="button" id="managerBatchRefreshIcons">刷新图标</button>
        <button class="btn" type="button" id="managerBatchHealth">检测状态</button>
        <button class="btn danger-text" type="button" id="managerBatchDelete">批量删除</button>
      </div>
    `;
    const addWrap=sites.querySelector("#managerAddWrap");
    const addForm=document.getElementById("addForm");
    if(addForm)addWrap.append(addForm);

    // Categories: move existing blocks.
    categories.innerHTML=`
      <div class="manager-panel-title"><div><h3>分类管理</h3><p>“标题”只改变前台显示名称，不改内部分类键，因此不会破坏网站归属。</p></div></div>
    `;
    moveBlockFromTitle("分类管理",categories,"分类移动");
    moveBlockFromTitle("分类移动",categories,"我的新增");

    // Duplicates
    const dupPanel=document.getElementById("duplicatePanel");
    if(dupPanel){
      duplicates.append(dupPanel);
      const note=dupPanel.querySelector(".admin-note");
      if(note)note.textContent="重复检测分三级：完全同网址、同 hostname 不同路径、同主域名疑似重复。网址不同也能发现；疑似不同服务可点“忽略此组”。";
      const jump=dupPanel.querySelector("#jumpDeletedBtn");
      if(jump){jump.textContent="打开回收站";jump.onclick=()=>setTab("recycle")}
    }else{
      duplicates.innerHTML='<div class="manager-empty">重复检测模块正在初始化，请重新打开管理中心。</div>';
    }

    // Recycle
    recycle.innerHTML=`
      <div class="manager-panel-title"><div><h3>回收站</h3><p>已删除网站集中管理，不再放在页面最底部。</p></div></div>
    `;
    moveBlockFromTitle("已删除网站",recycle,"");

    // Data
    data.innerHTML=`
      <div class="manager-panel-title"><div><h3>数据中心</h3><p>D1 是正式数据源，KV 用于自定义 Logo 与高清 favicon 缓存。</p></div></div>
      <div class="manager-trend-head"><span>实时数据概览</span><small>折线为本机最近采样</small></div>
      <div class="manager-trend-grid" id="managerTrendGrid"></div>
      <div class="manager-data-grid manager-data-columns">
        <div class="manager-data-column">
          <div class="manager-data-card">
            <b>D1 云端数据</b>
            <p id="managerD1Info">正在读取当前数据状态…</p>
            <div class="manager-data-actions">
              <button class="btn primary" type="button" id="managerSyncNow">立即同步</button>
              <button class="btn" type="button" id="managerRefreshCloud">从云端刷新</button>
            </div>
          </div>
          <div class="manager-data-card">
            <b>KV 图标缓存</b>
            <p>自定义 Logo 保存在 Workers KV；自动 favicon 缓存 30 天后自动过期，孤儿自定义图标由维护器清理。</p>
            <div class="manager-data-actions">
              <button class="btn" type="button" id="managerGoSites">管理网站图标</button>
            </div>
          </div>
          <div class="manager-data-card">
            <b>本机缓存</b>
            <p id="managerLocalInfo">正在计算…</p>
            <div class="manager-data-actions">
              <button class="btn" type="button" id="managerUpdateUsage">刷新占用</button>
            </div>
          </div>
        </div>
        <div class="manager-data-column">
          <div class="manager-data-card manager-transfer-card">
            <b>配置、浏览器书签与完整备份</b>
            <p>支持 Chrome / Edge 书签 HTML 导入导出。</p>
            <div class="transfer-action-grid">
              <button class="btn" type="button" id="managerExport">导出配置</button>
              <button class="btn" type="button" id="managerImport">导入配置</button>
              <button class="btn" type="button" id="managerExportBookmarks">导出浏览器书签</button>
              <button class="btn" type="button" id="managerImportBookmarks">导入浏览器书签</button>
              <button class="btn primary" type="button" id="managerDisasterBackup">完整备份导出</button>
              <small class="transfer-helper">导出网站、分类、排序、收藏、设置及自定义图标数据</small>
            </div>
          </div>
          <div class="manager-data-card">
            <b>D1 / KV 存储维护</b>
            <p id="managerMaintenanceInfo">每 7 天自动安全维护一次：只清理超额旧快照和 KV 孤儿自定义图标；有效网站、收藏、自定义 Logo 不会删除。</p>
            <div class="manager-data-actions">
              <button class="btn" type="button" id="managerMaintenanceScan">立即扫描</button>
              <button class="btn" type="button" id="managerMaintenanceClean">安全清理</button>
            </div>
          </div>
        </div>
        <div class="manager-data-card manager-backup-card">
          <b>D1 版本恢复</b>
          <p>只有网站/分类等结构变化前才自动保留旧版本，最多 20 个快照；最近访问等轻量云端数据不生成整库快照。主题和卡片密度属于本机偏好，不进入 D1。恢复前仍会备份当前导航数据状态。</p>
          <div class="manager-backup-toolbar">
            <button class="btn primary" type="button" id="managerBackupNow">立即创建快照</button>
            <button class="btn" type="button" id="managerReloadBackups">刷新版本列表</button>
          </div>
          <div class="manager-backup-list" id="managerBackupList">
            <div class="manager-backup-empty">进入“数据”标签后加载云端版本。</div>
          </div>
        </div>
      </div>
    `;

    // Keep legacy custom list alive but out of the long UI; existing functions can still update it safely.
    const customTitle=findTitleRow("我的新增");
    if(customTitle){
      let node=customTitle;
      while(node){
        const next=node.nextElementSibling;
        if(node.classList?.contains("custom-title-row") && node!==customTitle && node.querySelector("h3")?.textContent.trim()==="已删除网站")break;
        if(node.classList?.contains("admin-divider")){node.remove();break}
        stash.append(node);
        node=next;
      }
    }

    // Anything left from the old long page goes to hidden compatibility stash.
    [...body.children].forEach(el=>{
      if(![overview,sites,categories,duplicates,recycle,data,stash].includes(el))stash.append(el);
    });
    body.append(overview,sites,categories,duplicates,recycle,data,stash);

    tabs.addEventListener("click",e=>{
      const btn=e.target.closest(".manager-tab");
      if(btn)setTab(btn.dataset.tab);
    });
    overview.addEventListener("click",e=>{
      const btn=e.target.closest("[data-go]");
      if(!btn)return;
      const tab=btn.dataset.go;
      setTab(tab);
      if(btn.dataset.add==="1")setTimeout(()=>document.getElementById("managerToggleAdd")?.click(),30);
      if(btn.dataset.scan==="1")setTimeout(()=>document.getElementById("scanDuplicatesBtn")?.click(),30);
    });

    document.getElementById("managerToggleAdd")?.addEventListener("click",()=>{
      const wrap=document.getElementById("managerAddWrap");
      wrap?.classList.toggle("show");
      if(wrap?.classList.contains("show"))document.getElementById("newName")?.focus();
    });
    document.getElementById("managerSiteSearch")?.addEventListener("input",()=>{managerPageSize=PAGE_SIZE;renderManagerSites()});
    document.getElementById("managerCategoryFilter")?.addEventListener("change",()=>{managerPageSize=PAGE_SIZE;renderManagerSites()});
    document.getElementById("managerLoadMore")?.addEventListener("click",()=>{managerPageSize+=PAGE_SIZE;renderManagerSites()});
    document.getElementById("managerBatchMove")?.addEventListener("click",batchMoveV18);
    document.getElementById("managerBatchRefreshIcons")?.addEventListener("click",batchRefreshIconsV181);
    document.getElementById("managerBatchHealth")?.addEventListener("click",batchHealthV181);
    document.getElementById("managerBatchDelete")?.addEventListener("click",batchDeleteV18);

    document.getElementById("managerSyncNow")?.addEventListener("click",async()=>{
      const btn=document.getElementById("managerSyncNow");if(btn)btn.disabled=true;
      try{await pushV17({force:true});toast("已请求立即同步")}finally{if(btn)btn.disabled=false;renderDataPanel()}
    });
    document.getElementById("managerRefreshCloud")?.addEventListener("click",async()=>{
      const btn=document.getElementById("managerRefreshCloud");if(btn)btn.disabled=true;
      try{await refreshV17FromServer({quiet:false});toast("已从 D1 刷新")}finally{if(btn)btn.disabled=false;renderDataPanel()}
    });
    document.getElementById("managerExport")?.addEventListener("click",()=>document.getElementById("exportBtn")?.click());
    document.getElementById("managerExportBookmarks")?.addEventListener("click",()=>document.getElementById("exportBookmarksBtn")?.click());
    document.getElementById("managerImportBookmarks")?.addEventListener("click",()=>document.getElementById("importBookmarksBtn")?.click());
    document.getElementById("managerDisasterBackup")?.addEventListener("click",()=>document.getElementById("disasterBackupBtn")?.click());
    document.getElementById("managerImport")?.addEventListener("click",()=>document.getElementById("importBtn")?.click());
    document.getElementById("managerGoSites")?.addEventListener("click",()=>setTab("sites"));
    document.getElementById("managerUpdateUsage")?.addEventListener("click",()=>{updateStorageUsage();renderDataPanel()});
    document.getElementById("managerMaintenanceScan")?.addEventListener("click",()=>loadMaintenanceV1819(false,true));
    document.getElementById("managerMaintenanceClean")?.addEventListener("click",()=>loadMaintenanceV1819(true,true));
    document.getElementById("managerBackupNow")?.addEventListener("click",createBackupNowV181);
    document.getElementById("managerReloadBackups")?.addEventListener("click",()=>loadBackupsV181(true));

    setupDuplicateV18();
    managerReady=true;
    rebuildManagerCategorySelects();
    setTab(STORE.get(MGR_TAB_KEY)||"overview");
    updateManagerBadges();
  }

  function rebuildManagerCategorySelects(){
    const filter=document.getElementById("managerCategoryFilter");
    const batch=document.getElementById("managerBatchCategory");
    if(filter){
      const current=filter.value;
      filter.innerHTML='<option value="">全部分类</option>';
      allCategories().forEach(c=>{
        const o=document.createElement("option");o.value=c.name;o.textContent=displayCategory(c.name);filter.append(o);
      });
      filter.value=current;
    }
    if(batch){
      const current=batch.value;
      batch.innerHTML="";
      allCategories().forEach(c=>{
        const o=document.createElement("option");o.value=c.name;o.textContent=displayCategory(c.name);batch.append(o);
      });
      if(current&&categoryByName(current))batch.value=current;
    }
  }

  function managerFilteredSites(){
    const q=String(document.getElementById("managerSiteSearch")?.value||"").trim().toLowerCase();
    const cat=String(document.getElementById("managerCategoryFilter")?.value||"");
    const categories=allCategories();
    const rank=new Map(categories.map((c,i)=>[c.name,i]));
    return rawSites()
      .filter(site=>!state.hiddenSites.has(site.id))
      .filter(site=>!cat||effectiveCategory(site)===cat)
      .filter(site=>{
        if(!q)return true;
        const effective=effectiveCategory(site);
        const hay=[site.name,site.domain,safeDomain(site.url),effective,displayCategory(effective),site.url].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a,b)=>{
        const ca=rank.get(effectiveCategory(a))??Number.MAX_SAFE_INTEGER;
        const cb=rank.get(effectiveCategory(b))??Number.MAX_SAFE_INTEGER;
        return ca-cb||String(a.name).localeCompare(String(b.name),"zh-Hans-CN");
      });
  }

  function renderManagerSites(){
    const box=document.getElementById("managerSiteList");
    if(!box)return;
    const all=managerFilteredSites();
    const shown=all.slice(0,managerPageSize);
    const validIds=new Set(all.map(s=>s.id));
    managerSelection=new Set([...managerSelection].filter(id=>validIds.has(id)));
    const frag=document.createDocumentFragment();
    shown.forEach(site=>{
      const row=document.createElement("div");
      row.className="manager-site-row";
      row.dataset.siteId=site.id;
      const check=document.createElement("input");
      check.type="checkbox";check.className="manager-check";check.checked=managerSelection.has(site.id);
      check.addEventListener("change",()=>{check.checked?managerSelection.add(site.id):managerSelection.delete(site.id);updateBatchBar()});
      const icon=createSiteIcon(site,"custom-mini-icon");
      const copy=document.createElement("div");copy.className="manager-site-copy";
      const b=document.createElement("b");b.textContent=site.name;
      const sm=document.createElement("small");
      const health=managerHealth.get(site.id);
      sm.textContent=`${displayCategory(effectiveCategory(site))} · ${site.domain||safeDomain(site.url)}`;
      if(health){
        const chip=document.createElement("span");
        chip.className=`manager-health-chip ${health.kind==="ok"?"manager-health-ok":health.kind==="warn"?"manager-health-warn":"manager-health-bad"}`;
        chip.textContent=health.label;
        sm.append(document.createTextNode(" "),chip);
      }
      copy.append(b,sm);
      const kind=document.createElement("span");kind.className="manager-site-kind";kind.textContent=isBuiltinSite(site.id)?"内置":"自建";
      const actions=document.createElement("div");actions.className="manager-site-actions";
      const edit=document.createElement("button");edit.type="button";edit.className="mini-btn";edit.textContent="编辑";edit.onclick=()=>openSiteEditor(site);
      const del=document.createElement("button");del.type="button";del.className="mini-btn danger";del.textContent="删除";del.onclick=()=>deleteOneV18(site);
      actions.append(edit,del);
      row.append(check,icon,copy,kind,actions);
      frag.append(row);
    });
    box.replaceChildren(frag);
    if(!shown.length)box.innerHTML='<div class="manager-empty">没有找到符合条件的网站。</div>';
    const more=document.getElementById("managerLoadMore");
    if(more){more.hidden=shown.length>=all.length;more.textContent=`显示更多（${shown.length}/${all.length}）`}
    updateBatchBar();
    updateManagerBadges();
  }

  async function deleteOneV18(site){
    if(!await uiConfirmV1821(`删除「${site.name}」？\n\n网站会进入回收站，可恢复。`))return;
    state.hiddenSites.add(site.id);
    state.favorites.delete(site.id);
    state.recents=state.recents.filter(id=>id!==site.id);
    managerSelection.delete(site.id);
    if(!save())return;
    buildNav();render();renderDeletedList();renderCustomList();buildMoveSiteOptions();
    renderManagerSites();updateManagerBadges();toast("网站已移入回收站");
  }
  function updateBatchBar(){
    const bar=document.getElementById("managerBatchBar");
    const count=document.getElementById("managerBatchCount");
    const n=managerSelection.size;
    bar?.classList.toggle("show",n>0);
    if(count)count.textContent=`已选 ${n} 项`;
  }
  async function batchMoveV18(){
    const ids=[...managerSelection];
    const target=document.getElementById("managerBatchCategory")?.value;
    if(!ids.length||!target)return;
    if(!await uiConfirmV1821(`把选中的 ${ids.length} 个网站移动到「${displayCategory(target)}」？`))return;
    ids.forEach(id=>{
      const site=rawSites().find(s=>s.id===id);
      if(site)state.categoryOverrides[id]=target;
    });
    if(!save())return;
    managerSelection.clear();
    buildNav();render();buildMoveSiteOptions();renderManagerSites();toast(`已批量移动 ${ids.length} 个网站`);
  }
  async function batchDeleteV18(){
    const ids=[...managerSelection];
    if(!ids.length)return;
    if(!await uiConfirmV1821(`把选中的 ${ids.length} 个网站移入回收站？`))return;
    ids.forEach(id=>{
      state.hiddenSites.add(id);
      state.favorites.delete(id);
      state.recents=state.recents.filter(x=>x!==id);
    });
    if(!save())return;
    managerSelection.clear();
    buildNav();render();renderDeletedList();renderCustomList();buildMoveSiteOptions();renderManagerSites();updateManagerBadges();toast(`已批量删除 ${ids.length} 个网站`);
  }


  async function batchRefreshIconsV181(){
    const ids=[...managerSelection];
    if(!ids.length)return toast("请先选择网站");
    if(!await uiConfirmV1821(`重新抓取选中的 ${ids.length} 个网站高清图标？\n\n手动上传的自定义 Logo 会自动跳过。`))return;
    const btn=document.getElementById("managerBatchRefreshIcons");
    if(btn){btn.disabled=true;btn.textContent="刷新中…"}
    try{
      const result=await v17Request("refresh-icons","POST",{ids});
      toast(`图标刷新完成：${result.refreshed||0} 个，跳过 ${result.skipped||0} 个`);
      await refreshV17FromServer({quiet:true});
      renderManagerSites();
    }catch(err){
      alert(err?.message||"刷新图标失败");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="刷新图标"}
    }
  }

  async function batchHealthV181(){
    const ids=[...managerSelection];
    if(!ids.length)return toast("请先选择要检测的网站");
    if(ids.length>40&&!await uiConfirmV1821(`本次选择了 ${ids.length} 个网站，检测可能需要一些时间。继续？`))return;
    const btn=document.getElementById("managerBatchHealth");
    if(btn){btn.disabled=true;btn.textContent="检测中…"}
    try{
      const chunks=[];
      for(let i=0;i<ids.length;i+=12)chunks.push(ids.slice(i,i+12));
      for(let i=0;i<chunks.length;i++){
        if(btn)btn.textContent=`检测 ${i+1}/${chunks.length}`;
        const result=await v17Request("health","POST",{ids:chunks[i]});
        (result.results||[]).forEach(r=>managerHealth.set(r.id,r));
        renderManagerSites();
      }
      const vals=ids.map(id=>managerHealth.get(id)).filter(Boolean);
      const ok=vals.filter(x=>x.kind==="ok").length;
      const warn=vals.filter(x=>x.kind==="warn").length;
      const bad=vals.filter(x=>x.kind==="bad").length;
      toast(`状态检测完成：正常 ${ok} · 受限/重定向 ${warn} · 失败 ${bad}`);
    }catch(err){
      alert(err?.message||"网站状态检测失败");
    }finally{
      if(btn){btn.disabled=false;btn.textContent="检测状态"}
    }
  }

  function duplicateGroupsV18(){
    const rootMap=new Map();
    rawSites().filter(site=>!state.hiddenSites.has(site.id)).forEach(site=>{
      const meta=v18UrlMeta(site.url);
      if(!meta.root)return;
      if(!rootMap.has(meta.root))rootMap.set(meta.root,[]);
      rootMap.get(meta.root).push({...site,__meta:meta});
    });
    return [...rootMap.entries()]
      .map(([root,sites])=>{
        const unique=[...new Map(sites.map(s=>[s.id,s])).values()];
        const canonicals=new Set(unique.map(s=>s.__meta.canonical));
        const hosts=new Set(unique.map(s=>s.__meta.host));
        const tier=canonicals.size===1?"exact":hosts.size===1?"host":"root";
        const key=`${tier}:${tier==="exact"?[...canonicals][0]:tier==="host"?[...hosts][0]:root}`;
        return {root,sites:unique,tier,key};
      })
      .filter(g=>g.sites.length>1&&!state.duplicateIgnoreKeys.has(g.key))
      .sort((a,b)=>{
        const rank={exact:0,host:1,root:2};
        return rank[a.tier]-rank[b.tier]||b.sites.length-a.sites.length||a.root.localeCompare(b.root);
      });
  }
  function keepScoreV18(site){
    let n=0;
    if(isBuiltinSite(site.id))n+=80;
    if(state.favorites.has(site.id))n+=40;
    if(!state.hiddenSites.has(site.id))n+=15;
    const i=state.recents.indexOf(site.id);if(i>=0)n+=Math.max(12-i,1);
    return n;
  }
  function setupDuplicateV18(){
    const scan=document.getElementById("scanDuplicatesBtn");
    if(scan){
      scan.addEventListener("click",e=>{
        e.preventDefault();e.stopImmediatePropagation();
        renderDuplicatesV18();
      },true);
    }
    const toolbar=document.querySelector("#duplicatePanel .duplicate-toolbar");
    if(toolbar&&!document.getElementById("resetDuplicateIgnoreV181")){
      const reset=document.createElement("button");
      reset.type="button";
      reset.id="resetDuplicateIgnoreV181";
      reset.className="btn manager-ignore-reset";
      reset.textContent="重置忽略";
      reset.title="重新显示以前忽略的疑似重复组";
      reset.onclick=async()=>{
        if(!state.duplicateIgnoreKeys.size)return toast("没有被忽略的重复组");
        if(!await uiConfirmV1821(`重新启用 ${state.duplicateIgnoreKeys.size} 条忽略规则？`))return;
        state.duplicateIgnoreKeys.clear();
        saveDuplicateIgnoreLocal();
        save();
        renderDuplicatesV18();
        toast("已重置重复忽略规则");
      };
      toolbar.append(reset);
    }
  }
  function renderDuplicatesV18(){
    const box=document.getElementById("duplicateList");
    const count=document.getElementById("duplicateCount");
    if(!box||!count)return;
    duplicateScanned=true;
    const groups=duplicateGroupsV18();
    count.textContent=`${groups.length} 组`;
    box.innerHTML="";
    if(!groups.length){
      box.innerHTML='<div class="duplicate-empty">没有检测到重复项，或相关疑似组已被忽略。</div>';
      updateManagerBadges();return;
    }
    groups.forEach(group=>{
      const sites=group.sites.slice().sort((a,b)=>keepScoreV18(b)-keepScoreV18(a)||String(a.name).localeCompare(String(b.name),"zh-Hans-CN"));
      const keep=sites[0];
      const tierText=group.tier==="exact"?"完全同网址":group.tier==="host"?"同域名 · 路径不同":"同主域名 · 疑似重复";
      const tierClass=group.tier==="exact"?"dup-exact":group.tier==="host"?"dup-host":"dup-root";
      const wrap=document.createElement("div");wrap.className="duplicate-group";
      const head=document.createElement("div");head.className="duplicate-group-head";
      head.innerHTML=`
        <div class="duplicate-group-title">
          <strong>${group.root}</strong>
          <span class="dup-chip ${tierClass}">${tierText}</span>
          <span class="dup-chip">${sites.length} 个站点</span>
        </div>
        <div class="manager-dup-actions">
          <button class="btn dup-ignore-btn" type="button">忽略此组</button>
          <button class="btn dup-hide-btn" type="button">一键去重</button>
        </div>`;
      const buttons=head.querySelectorAll("button");
      buttons[0].onclick=()=>ignoreDuplicateGroupV181(group);
      buttons[1].onclick=()=>dedupeGroupV18(group.key,keep.id);
      const body=document.createElement("div");body.className="duplicate-items";
      sites.forEach(site=>{
        const row=document.createElement("div");row.className="dup-item";
        row.dataset.siteId=site.id;
        const icon=createSiteIcon(site,"custom-mini-icon");
        const copy=document.createElement("div");copy.className="dup-item-copy";
        const b=document.createElement("b");b.textContent=site.name;
        const sm=document.createElement("small");sm.textContent=`${displayCategory(effectiveCategory(site))} · ${site.__meta.host} · ${site.url}`;
        copy.append(b,sm);
        const actions=document.createElement("div");actions.className="manager-dup-actions";
        const badge=document.createElement("span");badge.className="dup-chip"+(site.id===keep.id?" dup-keep":"");badge.textContent=site.id===keep.id?"建议保留":(isBuiltinSite(site.id)?"内置":"自建");
        const locate=document.createElement("button");locate.type="button";locate.className="mini-btn manager-locate-btn";locate.textContent="定位";locate.onclick=()=>locateSiteV18(site);
        const edit=document.createElement("button");edit.type="button";edit.className="mini-btn";edit.textContent="编辑";edit.onclick=()=>openSiteEditor(site);
        actions.append(badge,locate,edit);
        row.append(icon,copy,actions);
        body.append(row);
      });
      wrap.append(head,body);box.append(wrap);
    });
    updateManagerBadges();
  }
  function ignoreDuplicateGroupV181(group){
    state.duplicateIgnoreKeys.add(group.key);
    saveDuplicateIgnoreLocal();
    save();
    renderDuplicatesV18();
    toast("已忽略此重复组，可通过“重置忽略”恢复");
  }
  async function dedupeGroupV18(groupKey,keepId){
    const g=duplicateGroupsV18().find(x=>x.key===groupKey);if(!g)return;
    const targets=g.sites.filter(s=>s.id!==keepId);
    if(!targets.length)return;
    const keep=g.sites.find(s=>s.id===keepId);
    const level=g.tier==="root"?"注意：这些网址属于同一主域名，但可能是不同子服务。\n\n":"";
    if(!await uiConfirmV1821(`${level}保留「${keep?.name||"建议项"}」，其余 ${targets.length} 个移入回收站？`))return;
    targets.forEach(site=>{
      state.hiddenSites.add(site.id);state.favorites.delete(site.id);state.recents=state.recents.filter(id=>id!==site.id);
    });
    if(!save())return;
    buildNav();render();renderDeletedList();renderCustomList();buildMoveSiteOptions();renderDuplicatesV18();renderManagerSites();toast(`已处理 ${targets.length} 个重复项`);
  }
  function locateSiteV18(site){
    closeDrawer();
    state.filter=effectiveCategory(site);
    state.query="";
    const s=document.getElementById("searchInput");if(s)s.value="";
    buildNav();render();
    setTimeout(()=>{
      const card=document.querySelector(`.card[data-site-id="${CSS.escape(site.id)}"]`);
      if(card){
        card.scrollIntoView({behavior:"smooth",block:"center"});
        card.classList.add("manager-locate-flash");
        setTimeout(()=>card.classList.remove("manager-locate-flash"),1800);
      }
    },120);
  }



  function fmtBackupTimeV181(value){
    try{
      const d=new Date(String(value||"").replace(" ","T")+"Z");
      return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
    }catch{return String(value||"")}
  }
  async function loadBackupsV181(force=false){
    const box=document.getElementById("managerBackupList");
    if(!box||!AUTH_V161?.authenticated)return;
    if(!force&&box.dataset.loaded==="1")return;
    box.innerHTML='<div class="manager-backup-empty">正在读取 D1 版本历史…</div>';
    try{
      const result=await v17Request("backups");
      const rows=Array.isArray(result.backups)?result.backups:[];
      box.dataset.loaded="1";
      box.innerHTML="";
      const currentRow=document.createElement("div");currentRow.className="manager-backup-row is-current";
      const currentCopy=document.createElement("div");currentCopy.className="backup-meta";
      currentCopy.innerHTML=`<b>当前线上 · revision ${V17.revision||"—"}</b><small>${allSites().length} 个网站 · ${allCategories().length} 个分类 · 当前正在使用</small>`;
      const currentTag=document.createElement("span");currentTag.className="manager-current-tag";currentTag.textContent="CURRENT";
      currentRow.append(currentCopy,currentTag);box.append(currentRow);
      if(!rows.length){
        const empty=document.createElement("div");empty.className="manager-backup-empty";empty.textContent="暂时没有历史快照。下一次结构变化前会自动创建，也可以点“立即创建快照”。";box.append(empty);
        return;
      }
      rows.forEach(item=>{
        const row=document.createElement("div");row.className="manager-backup-row";
        const copy=document.createElement("div");copy.className="backup-meta";
        copy.innerHTML=`<b>${fmtBackupTimeV181(item.createdAt)} · revision ${item.revision}</b><small>${item.siteCount} 个网站 · ${item.categoryCount} 个分类</small>`;
        const tag=document.createElement("span");tag.className="manager-site-kind";tag.textContent=`#${item.id}`;
        const restore=document.createElement("button");restore.type="button";restore.className="btn backup-restore-btn";restore.textContent="恢复";
        restore.onclick=()=>restoreBackupV181(item);
        row.append(copy,tag,restore);box.append(row);
      });
    }catch(err){
      box.innerHTML="";
      const empty=document.createElement("div");
      empty.className="manager-backup-empty";
      empty.textContent=`版本列表读取失败：${String(err?.message||"未知错误")}`;
      box.append(empty);
    }
  }
  async function createBackupNowV181(){
    const btn=document.getElementById("managerBackupNow");if(btn){btn.disabled=true;btn.textContent="创建中…"}
    try{
      await v17Request("backup-now","POST",{});
      const box=document.getElementById("managerBackupList");if(box)box.dataset.loaded="";
      await loadBackupsV181(true);
      toast("D1 快照已创建");
    }catch(err){alert(err?.message||"创建快照失败")}
    finally{if(btn){btn.disabled=false;btn.textContent="立即创建快照"}}
  }
  async function restoreBackupV181(item){
    if(!await uiConfirmV1821(`恢复到 ${fmtBackupTimeV181(item.createdAt)} 的云端版本？\n\n当前状态会先自动创建一个新快照，因此仍可撤回。`))return;
    setCloudStatus("syncing","D1 恢复中…","正在恢复 Cloudflare D1 SQLite 历史版本");
    try{
      const result=await v17Request("restore-backup","POST",{id:item.id});
      V17.revision=Number(result.revision)||V17.revision;
      V17.lastSnapshot="";
      await refreshV17FromServer({quiet:false});
      const box=document.getElementById("managerBackupList");if(box)box.dataset.loaded="";
      await loadBackupsV181(true);
      renderManagerSites();
      renderCategoryManager();
      renderDeletedList();
      toast("历史版本已恢复");
    }catch(err){
      setCloudStatus("error","D1 恢复失败",err?.message||"恢复失败");
      alert(err?.message||"恢复历史版本失败");
    }
  }

  async function loadMaintenanceV1819(clean=false,force=false){
    const box=document.getElementById("managerMaintenanceInfo");
    if(!box||!AUTH_V161?.authenticated)return;
    if(!force&&!clean&&box.dataset.loaded==="1")return;
    if(clean&&!await uiConfirmV1821("执行安全清理？\n\n只会删除：\n1. 超过 20 个的旧 D1 快照\n2. D1 已不再引用的 KV 自定义图标\n\n有效网站、分类、收藏、当前自定义 Logo 不会删除。"))return;
    const scanBtn=document.getElementById("managerMaintenanceScan"),cleanBtn=document.getElementById("managerMaintenanceClean");
    if(scanBtn)scanBtn.disabled=true;if(cleanBtn)cleanBtn.disabled=true;
    box.textContent=clean?"正在安全清理 D1 / KV…":"正在扫描 D1 / KV…";
    try{
      const result=await v17Request("maintenance",clean?"POST":"GET",clean?{}:null);
      window.updateManagerMaintenanceTrendV1821?.(result);
      const d1=result?.d1||{},kv=result?.kv||{},policy=result?.policy||{};
      const last=result?.lastMaintenance?fmtBackupTimeV181(result.lastMaintenance):"尚未记录";
      const kvText=kv.enabled?`KV 自定义图标 ${Number(kv.customKeys)||0} 个，孤儿 ${Number(kv.orphanCustomKeys)||0} 个`:`KV 未绑定`;
      box.textContent=`D1：${Number(d1.sites)||0} 个网站 · ${Number(d1.categories)||0} 个分类 · ${Number(d1.backups)||0}/${Number(policy.backupKeep)||20} 个快照 · 完全重复网址 ${Number(d1.exactDuplicateUrls)||0}；${kvText}；favicon ${Number(policy.faviconTtlDays)||30} 天自动过期；上次维护：${last}。`;
      box.dataset.loaded="1";
      if(clean){
        toast(`安全清理完成：D1 旧快照 ${Number(result.deletedBackups)||0}，KV 孤儿图标 ${Number(kv.deletedOrphanIcons)||0}`);
        const list=document.getElementById("managerBackupList");if(list)list.dataset.loaded="";
        await loadBackupsV181(true);
      }
    }catch(err){
      box.textContent=`维护接口不可用：${String(err?.message||"未知错误")}。请同时使用支持 maintenance 的 data.js。`;
    }finally{if(scanBtn)scanBtn.disabled=false;if(cleanBtn)cleanBtn.disabled=false}
  }

  function renderDataPanel(){
    window.renderManagerTrendsV1821?.();
    const d1=document.getElementById("managerD1Info");
    if(d1)d1.textContent=`当前：${AUTH_V161?.authenticated?"管理员模式":"访客模式"} · D1 revision ${Number(V17?.revision)||0} · 增量写入模式 · 上次写入 ${Number(V17?.lastWriteRows)||0} 行 · ${navigator.onLine?"网络在线":"当前离线"}`;
    const local=document.getElementById("managerLocalInfo");
    if(local){
      const bytes=typeof storageBytes==="function"?storageBytes():0;
      local.textContent=`本机 localStorage 约 ${(bytes/1024).toFixed(0)} KB；云端正式数据仍以 D1 为准。`;
    }
    loadBackupsV181(false);
    loadMaintenanceV1819(false,false);
  }

  // Open manager: only render current tab, not every heavy module.
  const __openDrawerManagerV18=openDrawer;
  openDrawer=function(){
    const result=__openDrawerManagerV18();
    requestAnimationFrame(()=>{
      setupManagerCenter();
      const wanted=STORE.get(MGR_TAB_KEY)||"overview";
      const active=document.querySelector(".manager-tab.active")?.dataset.tab||"";
      if(active!==wanted)setTab(wanted);
      else{
        if(wanted==="sites")rebuildManagerCategorySelects();
        updateManagerBadges();
      }
    });
    return result;
  };
  document.getElementById("manageBtn").onclick=openDrawer;
  document.getElementById("compactManageBtn").onclick=openDrawer;
  document.getElementById("mobileManageBtn")?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();openDrawer()},true);

  // Keep Manager Center refreshed after common data mutations.
  const __renderDeletedListV18=renderDeletedList;
  renderDeletedList=function(){const r=__renderDeletedListV18();updateManagerBadges();return r};
  const __renderCustomListV18=renderCustomList;
  renderCustomList=function(){const r=__renderCustomListV18();updateManagerBadges();return r};

  // Initialize after legacy upgrade code has created duplicatePanel/metrics.
  setTimeout(()=>{
    setupManagerCenter();
    patchCategoryLabels();
  },0);
})();
