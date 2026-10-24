
/* ===================== V18.7 · Final Logic Runtime ===================== */
(function(){
  let forceAddOnceV183=false;
  let pendingDuplicateV183=null;

  function normalizeUrlInputV183(value){
    let raw=String(value||"").trim();
    if(!raw)return "";
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw="https://"+raw;
    try{
      const u=new URL(raw);
      if(!/^https?:$/.test(u.protocol))return raw;
      u.hostname=u.hostname.toLowerCase();
      return u.href;
    }catch{return raw}
  }

  function duplicateMetaV183(url){
    try{
      const u=new URL(normalizeUrlInputV183(url));
      u.hash="";
      [...u.searchParams.keys()]
        .filter(k=>/^utm_/i.test(k)||["from","ref","referrer","source","spm"].includes(k.toLowerCase()))
        .forEach(k=>u.searchParams.delete(k));
      if(u.pathname!=="/")u.pathname=u.pathname.replace(/\/+$/,"");
      const host=u.hostname.toLowerCase().replace(/^www\./,"");
      return {
        href:u.href,
        canonical:u.protocol+"//"+host+u.pathname+(u.searchParams.toString()?"?"+u.searchParams.toString():""),
        host,
        root:typeof v18RootDomain==="function"?v18RootDomain(host):rootDomainFromHost(host)
      };
    }catch{return {href:"",canonical:"",host:"",root:""}}
  }

  function duplicateCandidateV183(url,excludeId=""){
    const target=duplicateMetaV183(url);
    if(!target.root)return null;
    const list=rawSites()
      .filter(site=>site.id!==excludeId&&!state.hiddenSites.has(site.id))
      .map(site=>({site,meta:duplicateMetaV183(site.url)}));

    let hit=list.find(x=>x.meta.canonical&&x.meta.canonical===target.canonical);
    if(hit)return {...hit,tier:"exact",target};
    hit=list.find(x=>x.meta.host&&x.meta.host===target.host);
    if(hit)return {...hit,tier:"host",target};
    hit=list.find(x=>x.meta.root&&x.meta.root===target.root);
    return hit?{...hit,tier:"root",target}:null;
  }

  function ensureDuplicateUIV183(){
    const form=document.getElementById("addForm");
    if(!form)return null;
    let box=document.getElementById("v183DuplicateWarning");
    if(box)return box;

    box=document.createElement("div");
    box.id="v183DuplicateWarning";
    box.className="v183-dup-warning";
    box.innerHTML=`
      <div class="v183-dup-title">
        <span>检测到已有网站</span>
        <span class="v183-dup-level" id="v183DupLevel">疑似重复</span>
      </div>
      <div class="v183-dup-copy" id="v183DupCopy"></div>
      <div class="v183-dup-actions">
        <button class="btn" type="button" id="v183LocateExisting">定位已有网站</button>
        <button class="btn v183-force-btn" type="button" id="v183ForceAdd">仍然强制添加</button>
      </div>
      <div class="v183-dup-ok" id="v183ForceNote">本次已允许强制添加；提交后仍会保留在重复检测候选中。</div>
    `;
    const actions=form.querySelector(".admin-actions");
    if(actions)actions.before(box);else form.append(box);

    box.querySelector("#v183LocateExisting").onclick=()=>{
      const site=pendingDuplicateV183?.site;
      if(!site)return;
      if(typeof locateSiteV18==="function")locateSiteV18(site);
    };

    box.querySelector("#v183ForceAdd").onclick=()=>{
      const dup=pendingDuplicateV183;
      if(!dup||dup.tier==="exact")return;
      forceAddOnceV183=true;
      box.querySelector("#v183ForceNote")?.classList.add("show");
      const btn=box.querySelector("#v183ForceAdd");
      if(btn){btn.textContent="正在强制添加…";btn.disabled=true}
      document.getElementById("addForm")?.requestSubmit();
    };
    return box;
  }

  function renderDuplicateWarningV183(dup){
    const box=ensureDuplicateUIV183();
    if(!box)return;
    pendingDuplicateV183=dup||null;
    if(!dup){
      box.classList.remove("show","exact");
      return;
    }
    box.classList.add("show");
    box.classList.toggle("exact",dup.tier==="exact");

    const force=box.querySelector("#v183ForceAdd");
    if(force){force.disabled=false;force.textContent="仍然强制添加";force.hidden=dup.tier==="exact"}
    box.querySelector("#v183ForceNote")?.classList.remove("show");

    const level=dup.tier==="exact"?"完全相同网址":dup.tier==="host"?"同一域名 · 地址不同":"同一主域名 · 不同服务";
    const desc=dup.tier==="exact"
      ?"这是同一个网址，属于真正重复项，因此不能强制添加。"
      :dup.tier==="host"
        ?"域名相同，但路径或参数不同。确认用途不同后可以强制添加。"
        :"例如 Google 与 Gmail：同属 google.com，但服务用途不同，可以强制添加。";

    box.querySelector("#v183DupLevel").textContent=level;
    box.querySelector("#v183DupCopy").textContent=
      `${desc} 已有：${dup.site.name} · ${displayCategory(effectiveCategory(dup.site))} · ${dup.site.url}`;
  }

  function inspectNewUrlV183(){
    const input=document.getElementById("newUrl");
    if(!input)return;
    const raw=input.value.trim();
    if(!raw){renderDuplicateWarningV183(null);return}
    renderDuplicateWarningV183(duplicateCandidateV183(raw));
  }

  const newUrl=document.getElementById("newUrl");
  if(newUrl){
    newUrl.addEventListener("blur",()=>{
      const normalized=normalizeUrlInputV183(newUrl.value);
      if(normalized&&normalized!==newUrl.value.trim())newUrl.value=normalized;
      inspectNewUrlV183();
    });
    newUrl.addEventListener("input",()=>{
      forceAddOnceV183=false;
      clearTimeout(newUrl.__v183Timer);
      newUrl.__v183Timer=setTimeout(inspectNewUrlV183,180);
    });
  }

  document.getElementById("addForm")?.addEventListener("submit",e=>{
    if(!AUTH_V161?.authenticated)return;
    const input=document.getElementById("newUrl");
    if(input){
      const normalized=normalizeUrlInputV183(input.value);
      if(normalized)input.value=normalized;
    }
    const dup=duplicateCandidateV183(input?.value||"");
    pendingDuplicateV183=dup;

    if(!dup){
      forceAddOnceV183=false;
      renderDuplicateWarningV183(null);
      return;
    }
    if(dup.tier==="exact"){
      e.preventDefault();e.stopImmediatePropagation();
      renderDuplicateWarningV183(dup);
      input?.focus();
      return false;
    }
    if(forceAddOnceV183){
      forceAddOnceV183=false;
      return;
    }
    e.preventDefault();e.stopImmediatePropagation();
    renderDuplicateWarningV183(dup);
    return false;
  },true);

  const __saveSiteEditorV183=saveSiteEditor;
  saveSiteEditor=async function(){
    const current=rawSites().find(s=>s.id===editingSiteId);
    const input=document.getElementById("editSiteUrl");
    if(input){
      const normalized=normalizeUrlInputV183(input.value);
      if(normalized)input.value=normalized;
    }
    const dup=duplicateCandidateV183(input?.value||"",current?.id||"");
    if(dup){
      if(dup.tier==="exact"){
        alert(`这个网址已经存在：${dup.site.name}\n已有位置：${displayCategory(effectiveCategory(dup.site))}\n\n完全相同网址不能重复保存。`);
        return;
      }
      const label=dup.tier==="host"?"同一域名":"同一主域名";
      if(!await uiConfirmV1821(`检测到疑似重复：${dup.site.name}\n判定：${label}\n已有网址：${dup.site.url}\n\n如果两个网站用途确实不同，可以强制保存当前修改。\n\n仍然保存？`))return;
    }
    return __saveSiteEditorV183();
  };
  document.getElementById("saveSiteEditor").onclick=saveSiteEditor;

  function flushD1KeepaliveV183(){
    if(!V17.ready||V17.suppress)return;
    clearTimeout(V17.pushTimer);
    const snap=makeV17Snapshot();
    const hash=JSON.stringify(snap);
    if(hash===V17.lastSnapshot)return;
    try{
      fetch(v17Query("sync"),{
        method:"POST",
        headers:{Accept:"application/json","Content-Type":"application/json"},
        credentials:"include",
        cache:"no-store",
        keepalive:true,
        body:JSON.stringify({...snap,force:false})
      }).catch(()=>{});
    }catch{}
  }
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden")flushD1KeepaliveV183();
  },{passive:true});
  window.addEventListener("pagehide",flushD1KeepaliveV183,{passive:true});

  document.getElementById("addForm")?.addEventListener("reset",()=>{
    pendingDuplicateV183=null;forceAddOnceV183=false;
    setTimeout(()=>renderDuplicateWarningV183(null),0);
  });

  ensureDuplicateUIV183();
})();
