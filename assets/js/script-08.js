
(()=>{
  "use strict";
  let dialogState=null;
  function ensureDialogV1821(){
    let root=document.getElementById("fxDialogV1821");if(root)return root;
    root=document.createElement("div");root.id="fxDialogV1821";root.className="fx-dialog-backdrop";root.setAttribute("aria-hidden","true");
    root.innerHTML=`<div class="fx-dialog" role="dialog" aria-modal="true" aria-labelledby="fxDialogTitleV1821"><div class="fx-dialog-accent"></div><div class="fx-dialog-body"><div class="fx-dialog-title-row"><div class="fx-dialog-icon">◇</div><h3 class="fx-dialog-title" id="fxDialogTitleV1821">提示</h3></div><div class="fx-dialog-message" id="fxDialogMessageV1821"></div><input class="fx-dialog-input" id="fxDialogInputV1821" hidden autocomplete="off"></div><div class="fx-dialog-actions"><button class="fx-dialog-btn" type="button" id="fxDialogCancelV1821">取消</button><button class="fx-dialog-btn primary" type="button" id="fxDialogOkV1821">确定</button></div></div>`;
    document.body.append(root);
    const cancel=root.querySelector("#fxDialogCancelV1821"),ok=root.querySelector("#fxDialogOkV1821"),input=root.querySelector("#fxDialogInputV1821");
    const finish=value=>{if(!dialogState)return;const {resolve,previous}=dialogState;dialogState=null;root.classList.remove("show");root.setAttribute("aria-hidden","true");document.body.classList.remove("ui-overlay-open");setTimeout(()=>previous?.focus?.({preventScroll:true}),0);resolve(value)};
    cancel.addEventListener("click",()=>finish(dialogState?.type==="prompt"?null:false));ok.addEventListener("click",()=>finish(dialogState?.type==="prompt"?input.value:true));
    root.addEventListener("pointerdown",e=>{if(e.target===root&&dialogState?.cancelable!==false)finish(dialogState?.type==="prompt"?null:false)});
    document.addEventListener("keydown",e=>{if(!dialogState||!root.classList.contains("show"))return;if(e.key==="Escape"&&dialogState.cancelable!==false){e.preventDefault();finish(dialogState.type==="prompt"?null:false)}else if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();finish(dialogState.type==="prompt"?input.value:true)}},true);
    return root;
  }
  function openDialogV1821({type="confirm",title="确认操作",message="",value="",confirmText="确定",cancelText="取消",danger=false,cancelable=true}={}){
    const root=ensureDialogV1821();if(dialogState){dialogState.resolve(dialogState.type==="prompt"?null:false);dialogState=null}
    const input=root.querySelector("#fxDialogInputV1821"),cancel=root.querySelector("#fxDialogCancelV1821"),ok=root.querySelector("#fxDialogOkV1821");
    root.querySelector("#fxDialogTitleV1821").textContent=title||"提示";root.querySelector("#fxDialogMessageV1821").textContent=String(message||"");
    input.hidden=type!=="prompt";input.value=type==="prompt"?String(value??""):"";cancel.hidden=type==="alert";cancel.textContent=cancelText||"取消";ok.textContent=confirmText||(type==="alert"?"知道了":"确定");
    const inferred=danger||/(删除|清理|覆盖|退出|去重|恢复.*版本)/.test(String(message||""));ok.classList.toggle("danger",inferred);ok.classList.toggle("primary",!inferred);
    root.classList.add("show");root.setAttribute("aria-hidden","false");document.body.classList.add("ui-overlay-open");
    return new Promise(resolve=>{dialogState={resolve,type,cancelable,previous:document.activeElement};requestAnimationFrame(()=>requestAnimationFrame(()=>{(type==="prompt"?input:ok).focus({preventScroll:true});if(type==="prompt")input.select()}))});
  }
  window.uiConfirmV1821=(message,opts={})=>openDialogV1821({type:"confirm",message,...opts});
  window.uiAlertV1821=(message,opts={})=>openDialogV1821({type:"alert",title:"提示",confirmText:"知道了",cancelable:false,message,...opts});
  window.uiPromptV1821=(message,value="",opts={})=>openDialogV1821({type:"prompt",title:"输入内容",message,value,...opts});
  window.alert=message=>{window.uiAlertV1821(String(message??""))};

  /* Smooth pointer sorting: one ghost + one placeholder, no native HTML5 drag image. */
  let drag=null,raf=0,lastPointer=null,scrollRaf=0;
  function cleanupDrag(){document.body.classList.remove("sort-drag-active");document.querySelectorAll(".grid.sort-over").forEach(g=>g.classList.remove("sort-over"));window.removeEventListener("pointermove",onMove,true);window.removeEventListener("pointerup",onUp,true);window.removeEventListener("pointercancel",onCancel,true);if(scrollRaf){cancelAnimationFrame(scrollRaf);scrollRaf=0}if(raf){cancelAnimationFrame(raf);raf=0}}
  function rectMap(grids){const map=new Map();[...new Set(grids.filter(Boolean))].forEach(g=>g.querySelectorAll(".card[data-site-id]").forEach(el=>map.set(el,el.getBoundingClientRect())));return map}
  function animateReflow(before){requestAnimationFrame(()=>{for(const [el,r0] of before){if(!el.isConnected)continue;const r1=el.getBoundingClientRect(),dx=r0.left-r1.left,dy=r0.top-r1.top;if(Math.abs(dx)<.5&&Math.abs(dy)<.5)continue;el.style.transition="none";el.style.transform=`translate3d(${dx}px,${dy}px,0)`;el.getBoundingClientRect();el.classList.add("sort-reflowing");el.style.transition="";el.style.transform="";setTimeout(()=>el.classList.remove("sort-reflowing"),210)}})}
  function pickInsertion(grid,x,y){const cards=[...grid.querySelectorAll(".card[data-site-id]")];if(!cards.length)return {ref:null,before:true,key:`${grid.dataset.category}|empty`};let best=null,dist=Infinity,before=true;for(const el of cards){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(x-cx)/Math.max(r.width,1),dy=(y-cy)/Math.max(r.height,1),d=dx*dx+dy*dy*1.35;if(d<dist){dist=d;best=el;before=(y<cy-r.height*.18)||(Math.abs(y-cy)<=r.height*.38&&x<cx)}}return {ref:best,before,key:`${grid.dataset.category}|${best?.dataset.siteId||""}|${before?1:0}`}}
  function positionGhost(){raf=0;if(!drag||!lastPointer)return;const x=lastPointer.clientX-drag.offsetX,y=lastPointer.clientY-drag.offsetY;drag.ghost.style.transform=`translate3d(${Math.round(x)}px,${Math.round(y)}px,0) scale(1.018)`;const under=document.elementFromPoint(lastPointer.clientX,lastPointer.clientY),grid=under?.closest?.('.grid[data-category]');if(!grid||!grid.dataset.category)return;const pos=pickInsertion(grid,lastPointer.clientX,lastPointer.clientY);if(pos.key===drag.lastKey)return;const oldGrid=drag.placeholder.closest(".grid"),before=rectMap([oldGrid,grid]);if(!pos.ref)grid.append(drag.placeholder);else grid.insertBefore(drag.placeholder,pos.before?pos.ref:pos.ref.nextSibling);drag.lastKey=pos.key;document.querySelectorAll(".grid.sort-over").forEach(g=>g.classList.toggle("sort-over",g===grid));animateReflow(before)}
  function onMove(e){if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();lastPointer=e;if(!raf)raf=requestAnimationFrame(positionGhost)}
  function autoScroll(){if(!drag||!lastPointer){scrollRaf=0;return}const edge=Math.min(120,innerHeight*.16),y=lastPointer.clientY;let v=0;if(y<edge)v=-Math.ceil((edge-y)/edge*18);else if(y>innerHeight-edge)v=Math.ceil((y-(innerHeight-edge))/edge*18);if(v){window.scrollBy(0,v);if(!raf)raf=requestAnimationFrame(positionGhost)}scrollRaf=requestAnimationFrame(autoScroll)}
  function finalizeDrag(commit){if(!drag)return;const d=drag;drag=null;cleanupDrag();if(!commit){d.placeholder.replaceWith(d.card);d.ghost.remove();render();return}const targetGrid=d.placeholder.closest(".grid"),targetCategory=targetGrid?.dataset.category||d.sourceCategory;d.placeholder.replaceWith(d.card);d.ghost.remove();for(const cat of Object.keys(state.siteOrder||{})){state.siteOrder[cat]=(state.siteOrder[cat]||[]).filter(id=>id!==d.site.id);if(!state.siteOrder[cat].length)delete state.siteOrder[cat]}if(targetCategory===d.site.category)delete state.categoryOverrides[d.site.id];else state.categoryOverrides[d.site.id]=targetCategory;state.siteOrder[targetCategory]=[...targetGrid.querySelectorAll(".card[data-site-id]")].map(el=>el.dataset.siteId);if(!save()){render();return}buildNav();render();renderCustomList();buildMoveSiteOptions();toast(`「${d.site.name}」排序已保存`)}
  function onUp(e){if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();const d=drag,r=d.placeholder.getBoundingClientRect();window.removeEventListener("pointermove",onMove,true);window.removeEventListener("pointerup",onUp,true);window.removeEventListener("pointercancel",onCancel,true);if(scrollRaf){cancelAnimationFrame(scrollRaf);scrollRaf=0}d.ghost.style.transition="transform .14s cubic-bezier(.2,.8,.2,1),opacity .14s ease";d.ghost.style.transform=`translate3d(${Math.round(r.left)}px,${Math.round(r.top)}px,0) scale(1)`;d.ghost.style.opacity=".72";setTimeout(()=>finalizeDrag(true),145)}
  function onCancel(e){if(!drag||e.pointerId!==drag.pointerId)return;finalizeDrag(false)}
  function startSort(e,card,site){if(!state.sortMode||drag)return;if(e.pointerType==="mouse"&&e.button!==0)return;e.preventDefault();e.stopPropagation();const r=card.getBoundingClientRect(),grid=card.closest(".grid");if(!grid)return;const placeholder=document.createElement("div");placeholder.className="sort-placeholder";placeholder.style.minHeight=`${Math.round(r.height)}px`;const ghost=card.cloneNode(true);ghost.classList.remove("dragging");ghost.classList.add("sort-drag-ghost");ghost.style.width=`${Math.round(r.width)}px`;ghost.style.height=`${Math.round(r.height)}px`;ghost.querySelector(".sort-handle")?.remove();card.replaceWith(placeholder);document.body.append(ghost);drag={pointerId:e.pointerId,card,site,sourceCategory:grid.dataset.category,placeholder,ghost,offsetX:e.clientX-r.left,offsetY:e.clientY-r.top,lastKey:""};lastPointer=e;document.body.classList.add("sort-drag-active");grid.classList.add("sort-over");window.addEventListener("pointermove",onMove,{capture:true,passive:false});window.addEventListener("pointerup",onUp,{capture:true,passive:false});window.addEventListener("pointercancel",onCancel,true);positionGhost();scrollRaf=requestAnimationFrame(autoScroll)}
  window.bindSiteDrag=function(card,grid,site){card.draggable=false;card.removeAttribute("draggable");const handle=card.querySelector(".sort-handle");if(!handle)return;handle.textContent="";handle.setAttribute("aria-label",`拖动排序：${site.name}`);handle.setAttribute("role","button");handle.addEventListener("pointerdown",e=>startSort(e,card,site),{passive:false});handle.addEventListener("dragstart",e=>e.preventDefault())};
  window.bindGridDrop=function(){};

  /* Manager line cards. Samples are local; no extra D1/KV requests. */
  const TREND_KEY="fxnav_manager_trends_v1821";let maintenanceSnapshot=null,sparkId=0;
  function loadRows(){try{const x=JSON.parse(localStorage.getItem(TREND_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}}
  function saveRows(rows){try{localStorage.setItem(TREND_KEY,JSON.stringify(rows.slice(-18)))}catch{}}
  function sample(){
    let customIcons=0;
    try{customIcons=rawSites().filter(s=>s._customIcon||s.has_custom_icon).length}catch{}
    if(Number.isFinite(Number(maintenanceSnapshot?.kv?.customKeys)))customIcons=Number(maintenanceSnapshot.kv.customKeys);
    return {t:Date.now(),ready:!!V17?.ready,revision:Math.max(0,Number(V17?.revision)||0),writeRows:Math.max(0,Number(V17?.lastWriteRows)||0),sites:typeof allSites==="function"?allSites().length:0,customIcons};
  }
  function record(force=false){
    const stored=loadRows(),cur=sample();
    let rows=stored.filter(r=>r&&Number.isFinite(Number(r.t))&&Number(r.t)>0);
    // D1 revision is monotonic for this data lineage. Once a positive revision exists,
    // revision 0 is a bootstrap placeholder, not a later valid historical state.
    if(cur.revision>0)rows=rows.filter(r=>Number(r.revision)>0);
    const cleaned=rows.length!==stored.length;
    if(!cur.ready){if(cleaned)saveRows(rows);return rows}
    const last=rows.at(-1),changed=!last||["revision","writeRows","sites","customIcons"].some(k=>Number(last[k])!==Number(cur[k]));
    if(force||changed||!last||cur.t-last.t>30*60*1000){rows.push(cur);saveRows(rows);return rows}
    if(cleaned)saveRows(rows);
    return rows.length?rows:[cur];
  }
  function spark(values){
    let vals=values.map(v=>Number(v)||0);
    if(vals.length<2)return '<div class="manager-spark manager-spark-empty" aria-hidden="true"></div>';
    if(vals.length<4)vals=[...Array(4-vals.length).fill(vals[0]),...vals];
    const w=150,h=42,p=3,min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min),pts=vals.map((v,i)=>`${(p+i*(w-p*2)/Math.max(vals.length-1,1)).toFixed(1)},${(h-p-(v-min)/range*(h-p*2)).toFixed(1)}`).join(" "),last=pts.split(" ").at(-1).split(","),id=++sparkId;
    return `<svg class="manager-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sl${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#45d8ff"/><stop offset=".55" stop-color="#6d86ff"/><stop offset="1" stop-color="#cf63d5"/></linearGradient></defs><path class="gridline" d="M3 35.5H147"/><polyline class="line" stroke="url(#sl${id})" points="${pts}"/><circle class="dot" cx="${last[0]}" cy="${last[1]}" r="2.2"/></svg>`;
  }
  function card(label,value,suffix,foot,values){return `<div class="manager-trend-card"><div class="manager-trend-label">${label}</div><div class="manager-trend-value">${value}<small>${suffix}</small></div><div class="manager-trend-foot">${foot}</div>${spark(values)}</div>`}
  window.renderManagerTrendsV1821=function(){
    const box=document.getElementById("managerTrendGrid");if(!box)return;
    const cur=sample(),rows=record(false),series=k=>cur.ready?rows.slice(-12).map(r=>Number(r[k])||0):[];
    const shown=(value,suffix)=>cur.ready?{value,suffix}:{value:"—",suffix:""};
    const rev=shown(cur.revision,"rev"),writes=shown(cur.writeRows,"行"),sites=shown(cur.sites,"个"),icons=shown(cur.customIcons,"个");
    box.innerHTML=[
      card("D1 数据版本",rev.value,rev.suffix,cur.ready?"已就绪的云端版本":"等待 D1 初始化；暂不记录占位值",series("revision")),
      card("最近一次写入",writes.value,writes.suffix,cur.ready?"最近一次差异写入行数":"初始化后显示真实数据",series("writeRows")),
      card("有效网站",sites.value,sites.suffix,cur.ready?"当前导航数据":"初始化后显示真实数据",series("sites")),
      card("KV 自定义图标",icons.value,icons.suffix,cur.ready?"当前引用 / 最近扫描":"初始化后显示真实数据",series("customIcons"))
    ].join("");
  };
  window.updateManagerMaintenanceTrendV1821=function(result){maintenanceSnapshot=result||null;record(true);window.renderManagerTrendsV1821?.()};
})();
