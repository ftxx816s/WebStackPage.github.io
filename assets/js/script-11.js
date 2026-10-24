
(()=>{
  const ACT_KEY='fxnav_manager_activity_v1831';
  const MAINT_KEY='fxnav_manager_maintenance_cache_v1831';
  const SYNC_KEY='fxnav_manager_last_sync_v1831';
  const BACKUP_KEY='fxnav_manager_last_backup_v1831';
  const MAX_ACT=80;
  const getJSON=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}};
  const setJSON=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val))}catch{}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtTime=t=>{if(!t)return '尚未记录';const d=new Date(Number(t));if(!Number.isFinite(d.getTime()))return '尚未记录';const now=new Date(),same=d.toDateString()===now.toDateString();return same?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}):d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})};
  const dateKey=t=>{const d=new Date(t),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${d.getFullYear()}-${m}-${day}`};
  const activityType=msg=>{/D1|同步|快照|版本|KV|图标刷新|状态检测|配置已导入|清理/.test(msg)?'data':/分类|移动|排序/.test(msg)?'category':/删除|回收/.test(msg)?'warn':'site'};
  const shouldLog=msg=>[
    /已添加到导航/,/网站信息已更新/,/已删除「/,/已恢复「/,/网站已移入回收站/,/已批量/,/已新增分类/,/分类图标已更新/,/已重命名为/,/分类已删除/,/分类标题已/,/排序已保存/,/排序已完成/,/排序已恢复/,/已请求立即同步/,/已从 D1 刷新/,/D1 快照已创建/,/历史版本已恢复/,/安全清理完成/,/图标刷新完成/,/状态检测完成/,/已处理 .*重复项/,/已保留「/,/图标已上传到 KV/,/已恢复自动高清图标/,/配置已导入/
  ].some(r=>r.test(msg));
  function activities(){const a=getJSON(ACT_KEY,[]);return Array.isArray(a)?a:[]}
  function addActivity(msg){msg=String(msg||'').trim();if(!msg||!shouldLog(msg))return;let rows=activities();const last=rows.at(-1);if(last&&last.text===msg&&Date.now()-last.t<1500)return;rows.push({t:Date.now(),type:activityType(msg),text:msg});rows=rows.slice(-MAX_ACT);setJSON(ACT_KEY,rows);if(/D1 快照已创建/.test(msg))localStorage.setItem(BACKUP_KEY,String(Date.now()));render();}
  function localIconCount(){try{return rawSites().filter(s=>s?._customIcon||s?.has_custom_icon).length}catch{return 0}}
  function duplicateState(){const badge=document.querySelector('.manager-tab[data-tab="duplicates"] .manager-tab-badge');const scanned=badge&&badge.textContent.trim()!=='·';let n=0;if(scanned){const m=badge.textContent.match(/\d+/);n=m?Number(m[0]):document.querySelectorAll('#duplicateList .duplicate-group').length}return {scanned:!!scanned,count:n}}
  function maintenance(){const x=getJSON(MAINT_KEY,null);return x&&typeof x==='object'?x:null}
  function sevenDays(rows){const out=[];const now=new Date();for(let i=6;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);out.push({key:dateKey(d),label:`${d.getMonth()+1}/${d.getDate()}`,count:0})}const map=new Map(out.map(x=>[x.key,x]));rows.forEach(r=>{const x=map.get(dateKey(r.t));if(x)x.count++});return out}
  function chart(days){const vals=days.map(x=>x.count),w=360,h=100,pX=9,pY=12,max=Math.max(1,...vals);const pts=vals.map((v,i)=>{const x=pX+i*(w-pX*2)/6,y=h-pY-(v/max)*(h-pY*2);return [x,y]});const poly=pts.map(p=>p.map(x=>x.toFixed(1)).join(',')).join(' ');const area=`M ${pts[0][0].toFixed(1)} ${h-pY} L ${pts.map(p=>p.map(x=>x.toFixed(1)).join(' ')).join(' L ')} L ${pts.at(-1)[0].toFixed(1)} ${h-pY} Z`;return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="managerActivityGradV1831" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#44d4ff"/><stop offset=".52" stop-color="#6f82ff"/><stop offset="1" stop-color="#c762dc"/></linearGradient><linearGradient id="managerActivityAreaV1831" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7587ff" stop-opacity=".18"/><stop offset="1" stop-color="#7587ff" stop-opacity="0"/></linearGradient></defs><path class="manager-activity-gridline" d="M9 28H351M9 55H351M9 82H351"/><path class="manager-activity-area" d="${area}"/><polyline class="manager-activity-line" points="${poly}"/>${pts.map(p=>`<circle class="manager-activity-point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5"/>`).join('')}</svg>`}
  function render(){
    const box=document.getElementById('managerOverviewDashboard');if(!box)return;
    const online=navigator.onLine,ready=!!V17?.ready,rev=Math.max(0,Number(V17?.revision)||0),writes=Math.max(0,Number(V17?.lastWriteRows)||0);
    const maint=maintenance(),dup=duplicateState(),hidden=Number(state?.hiddenSites?.size)||0,sites=typeof allSites==='function'?allSites().length:0,icons=Number(maint?.kv?.customKeys);const iconCount=Number.isFinite(icons)?icons:localIconCount();
    const orphan=maint?.kv?.enabled?Math.max(0,Number(maint?.kv?.orphanCustomKeys)||0):null;
    const backups=maint?.d1?Math.max(0,Number(maint.d1.backups)||0):null,keep=Math.max(1,Number(maint?.policy?.backupKeep)||20),overBackups=backups===null?null:Math.max(0,backups-keep);
    const issues=(dup.scanned?dup.count:0)+(orphan||0)+(overBackups||0);const fullyChecked=dup.scanned&&!!maint;const healthText=issues>0?`${issues} 项待处理`:fullyChecked?'良好':'待检查';const healthClass=issues>0?'warn':fullyChecked?'ok':'idle';
    const syncAt=Number(localStorage.getItem(SYNC_KEY)||0),backupAt=Number(localStorage.getItem(BACKUP_KEY)||0),rows=activities(),days=sevenDays(rows),weekTotal=days.reduce((a,b)=>a+b.count,0),recent=rows.slice(-6).reverse();
    const d1State=!online?['当前离线','warn']:ready?['D1 已连接','ok']:['D1 初始化中','warn'];
    const kvState=maint?.kv?.enabled===false?'未绑定':maint?.kv?.enabled===true?'正常':'未扫描';
    box.innerHTML=`
      <section class="manager-live-card">
        <div class="manager-live-head"><b>D1 / KV 状态</b><small>事件驱动 · 不轮询</small></div>
        <div class="manager-status-line"><i class="manager-status-dot ${d1State[1]==='warn'?'warn':''}"></i><div class="manager-status-copy"><strong>${d1State[0]}</strong><span>D1 revision ${ready?rev:"—"} · ${online?'网络在线':'网络离线'} · KV ${kvState}</span></div></div>
        <div class="manager-kpi-row"><div class="manager-kpi"><span>最近写入</span><b>${writes} 行</b></div><div class="manager-kpi"><span>有效网站</span><b>${sites} 个</b></div><div class="manager-kpi"><span>KV 自定义图标</span><b>${iconCount} 个</b></div></div>
        <div class="manager-version-strip"><div class="manager-version-item"><span>最近同步</span><b>${fmtTime(syncAt)}</b></div><div class="manager-version-item"><span>数据版本</span><b>${ready?`rev ${rev}`:"等待初始化"}</b></div><div class="manager-version-item"><span>最近快照</span><b>${fmtTime(backupAt)}</b></div><div class="manager-version-item"><span>最近维护</span><b>${fmtTime(maint?.savedAt||maint?.lastMaintenance)}</b></div></div>
      </section>
      <section class="manager-live-card">
        <div class="manager-live-head"><b>数据健康</b><button class="manager-live-action" type="button" id="managerOverviewHealthScan">检查</button></div>
        <div class="manager-status-line"><i class="manager-status-dot ${issues>0?'warn':fullyChecked?'':'warn'}"></i><div class="manager-status-copy"><strong>${healthText}</strong><span>${fullyChecked?'最近维护结果 + 当前重复检测':'点击“检查”执行一次安全扫描；不会删除数据'}</span></div></div>
        <div class="manager-health-list">
          <div class="manager-health-row"><span>重复分组</span><b class="${dup.scanned?(dup.count?'warn':'ok'):'idle'}">${dup.scanned?dup.count+' 组':'未扫描'}</b></div>
          <div class="manager-health-row"><span>KV 孤儿图标</span><b class="${orphan===null?'idle':orphan?'warn':'ok'}">${orphan===null?'未扫描':orphan+' 个'}</b></div>
          <div class="manager-health-row"><span>超额旧快照</span><b class="${overBackups===null?'idle':overBackups?'warn':'ok'}">${overBackups===null?'未扫描':overBackups+' 个'}</b></div>
          <div class="manager-health-row"><span>回收站</span><b class="${hidden?'idle':'ok'}">${hidden} 个</b></div>
        </div>
      </section>
      <section class="manager-live-card wide">
        <div class="manager-live-head"><b>近 7 天活动</b><small>仅记录本机管理操作</small></div>
        <div class="manager-activity-wrap">
          <div class="manager-activity-chart"><div class="manager-activity-summary"><strong>${weekTotal}</strong><span>7 天管理操作</span></div>${chart(days)}<div class="manager-day-labels">${days.map(d=>`<span>${d.label}</span>`).join('')}</div></div>
          <div class="manager-activity-list">${recent.length?recent.map(r=>`<div class="manager-activity-item"><i class="manager-activity-type ${esc(r.type)}"></i><div class="manager-activity-copy" title="${esc(r.text)}">${esc(r.text)}</div><time class="manager-activity-time">${fmtTime(r.t)}</time></div>`).join(''):'<div class="manager-activity-empty">暂无管理操作记录。<br>之后新增、编辑、同步、清理、快照等成功操作会自动记录在这里。</div>'}</div>
        </div>
      </section>`;
    document.getElementById('managerOverviewHealthScan')?.addEventListener('click',()=>{
      if(typeof window.setManagerTabV18==='function')window.setManagerTabV18('data');
      setTimeout(()=>document.getElementById('managerMaintenanceScan')?.click(),60);
    });
  }
  window.renderManagerOverviewV1831=render;
  // Cache maintenance results only when the existing maintenance flow actually runs.
  if(typeof window.updateManagerMaintenanceTrendV1821==='function'){
    const old=window.updateManagerMaintenanceTrendV1821;
    window.updateManagerMaintenanceTrendV1821=function(result){if(result&&typeof result==='object'){setJSON(MAINT_KEY,{...result,savedAt:Date.now()})}const out=old.apply(this,arguments);render();return out};
  }
  // Record successful, user-visible management operations. No additional D1/KV traffic.
  if(typeof window.toast==='function'){
    const oldToast=window.toast;
    window.toast=function(msg){const out=oldToast.apply(this,arguments);addActivity(String(msg||''));return out};
  }
  // Track real D1 sync completion by observing the existing status setter, not by polling.
  if(typeof window.setCloudStatus==='function'){
    const oldStatus=window.setCloudStatus;
    window.setCloudStatus=function(stateName,label,detail){const out=oldStatus.apply(this,arguments);if(stateName==='synced'&&/数据版本/.test(String(detail||''))){localStorage.setItem(SYNC_KEY,String(Date.now()));render()}return out};
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.manager-tab');if(tab?.dataset.tab==='overview')setTimeout(render,0);
    if(e.target.closest?.('#manageBtn,#compactManageBtn,#mobileManageBtn'))setTimeout(render,80);
  },{passive:true});
  window.addEventListener('online',render,{passive:true});window.addEventListener('offline',render,{passive:true});
  setTimeout(render,120);
})();
