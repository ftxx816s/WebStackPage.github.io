/* V19.96: real browser-side telemetry for the manager overview.
   Uses existing D1 API Resource Timing, actual V17 sync state, and event-loop delay.
   It does not issue additional requests to D1/KV and never generates random samples. */
(()=>{
  'use strict';
  const ROOT_ID='managerOverviewDashboard';
  const MAX=30;
  const history={d1:[],sync:[],lag:[]};
  const seenResources=new Set();
  let lastD1Ms=null,lastD1At=0,lastLagMs=null;
  let dashboardObserver=null,rootObserver=null,resourceObserver=null;
  let refreshTimer=0;
  const $=(id,root=document)=>root.getElementById?root.getElementById(id):root.querySelector(`#${id}`);
  const push=(key,value)=>{
    const n=Number(value);
    if(!Number.isFinite(n))return;
    history[key].push(Math.max(0,n));
    if(history[key].length>MAX)history[key].splice(0,history[key].length-MAX);
  };
  const safeURL=value=>{try{return new URL(value,location.href)}catch{return null}};
  function isD1DataRequest(entry){
    const u=safeURL(entry?.name);
    if(!u||u.origin!==location.origin||u.pathname!=='/api/data')return false;
    const mode=u.searchParams.get('mode')||'';
    return mode!=='icon'&&mode!=='upload-icon';
  }
  function consumeResource(entry){
    if(!isD1DataRequest(entry))return;
    const key=`${entry.name}|${Number(entry.startTime).toFixed(2)}`;
    if(seenResources.has(key))return;
    seenResources.add(key);
    if(seenResources.size>500){const first=seenResources.values().next().value;seenResources.delete(first)}
    const duration=Number(entry.duration)||(Number(entry.responseEnd)-Number(entry.fetchStart));
    if(!Number.isFinite(duration)||duration<=0)return;
    lastD1Ms=duration;
    lastD1At=Date.now();
    push('d1',duration);
    updateStrip();
  }
  function scanResourceEntries(){
    try{performance.getEntriesByType('resource').forEach(consumeResource)}catch{}
  }
  function watchD1Requests(){
    try{performance.setResourceTimingBufferSize?.(500)}catch{}
    if('PerformanceObserver' in window){
      try{
        resourceObserver=new PerformanceObserver(list=>list.getEntries().forEach(consumeResource));
        resourceObserver.observe({type:'resource',buffered:true});
      }catch{
        try{resourceObserver=new PerformanceObserver(list=>list.getEntries().forEach(consumeResource));resourceObserver.observe({entryTypes:['resource']})}catch{resourceObserver=null}
      }
    }
    scanResourceEntries();
    setInterval(scanResourceEntries,2500);
  }
  function localSyncState(){
    const v=window.V17||{};
    if(v.conflict)return {value:3,label:'冲突待处理',state:'bad'};
    if(v.syncing)return {value:2,label:'正在同步',state:'warn'};
    if(v.pushQueued||v.pushTimer)return {value:1,label:'等待同步',state:'warn'};
    if(v.lastStatus==='synced'&&Number(v.lastSuccessAt)>0)return {value:0,label:'队列空闲',state:'ok'};
    return {value:0,label:'等待验证',state:'idle'};
  }
  function sampleSync(){push('sync',localSyncState().value)}
  function scheduleLagSample(){
    const target=performance.now()+1000;
    setTimeout(()=>{
      const drift=performance.now()-target;
      if(!document.hidden&&drift<5000){
        lastLagMs=Math.max(0,drift);
        push('lag',lastLagMs);
        updateStrip();
      }
      scheduleLagSample();
    },1000);
  }
  function linePoints(values,width=160,height=25){
    if(!values.length)return `0,${height/2} ${width},${height/2}`;
    if(values.length===1)return `0,${height/2} ${width},${height/2}`;
    const lo=Math.min(...values),hi=Math.max(...values);
    const spread=Math.max(hi-lo,Math.max(Math.abs(hi),Math.abs(lo),1)*.08,1);
    const min=lo-spread*.12,max=hi+spread*.12;
    return values.map((v,i)=>{
      const x=(i/(values.length-1))*width;
      const y=height-3-((v-min)/(max-min))*(height-6);
      return `${x.toFixed(1)},${Math.max(2,Math.min(height-2,y)).toFixed(1)}`;
    }).join(' ');
  }
  function drawSeries(root,key){
    const cell=root.querySelector(`.manager-monitor-cell[data-series="${key}"]`);
    if(!cell)return;
    const values=history[key];
    const line=cell.querySelector('.manager-monitor-line');
    const dot=cell.querySelector('.manager-monitor-endpoint');
    const points=linePoints(values);
    line?.setAttribute('points',points);
    if(dot){
      const last=points.trim().split(/\s+/).at(-1).split(',');
      dot.setAttribute('cx',last[0]);dot.setAttribute('cy',last[1]);
      dot.style.opacity=values.length?'1':'.45';
    }
  }
  function ageLabel(ms){
    if(!ms)return '暂无请求样本';
    const s=Math.max(0,Math.floor((Date.now()-ms)/1000));
    if(s<5)return '刚刚收到请求';
    if(s<60)return `${s} 秒前请求`;
    const m=Math.floor(s/60);
    return `${m} 分钟前请求`;
  }
  function updateStrip(){
    const root=document.querySelector(`#${ROOT_ID} .manager-monitor-strip`);
    if(!root)return;
    const d1Value=root.querySelector('[data-value="d1"]');
    const d1Sub=root.querySelector('[data-sub="d1"]');
    const d1Cell=root.querySelector('.manager-monitor-cell[data-series="d1"]');
    const v=window.V17||{};
    if(d1Value)d1Value.textContent=lastD1Ms===null?'等待请求':`${Math.round(lastD1Ms)} ms`;
    if(d1Sub)d1Sub.textContent=lastD1At?ageLabel(lastD1At):'记录已有 D1 请求';
    if(d1Cell){
      const successAt=Number(v.lastSuccessAt)||0, failureAt=Number(v.lastFailureAt)||0;
      const recent=successAt>0&&Date.now()-successAt<60000&&!v.cachedOffline&&v.lastStatus==='synced';
      const recentFailure=failureAt>successAt&&Date.now()-failureAt<60000;
      const state=v.conflict||recentFailure?'bad':v.syncing?'warn':recent?'ok':'idle';
      d1Cell.dataset.state=state;
    }
    const sync=localSyncState();
    const syncValue=root.querySelector('[data-value="sync"]');
    const syncSub=root.querySelector('[data-sub="sync"]');
    const syncCell=root.querySelector('.manager-monitor-cell[data-series="sync"]');
    if(syncValue)syncValue.textContent=sync.label;
    if(syncSub)syncSub.textContent=v.conflict?'本地修改已保护':v.syncing?'正在提交到 D1':v.pushQueued||v.pushTimer?'已有待同步任务':'读取现有同步状态';
    if(syncCell)syncCell.dataset.state=sync.state;
    const lagValue=root.querySelector('[data-value="lag"]');
    const lagSub=root.querySelector('[data-sub="lag"]');
    const lagCell=root.querySelector('.manager-monitor-cell[data-series="lag"]');
    if(lagValue)lagValue.textContent=lastLagMs===null?'采样中':`${Math.round(lastLagMs)} ms`;
    if(lagSub)lagSub.textContent='页面主线程调度延迟';
    if(lagCell)lagCell.dataset.state=lastLagMs===null?'idle':lastLagMs>120?'bad':lastLagMs>45?'warn':'ok';
    ['d1','sync','lag'].forEach(key=>drawSeries(root,key));
  }
  function makeStrip(){
    const section=document.createElement('section');
    section.className='manager-monitor-strip';
    section.setAttribute('aria-label','实时监控');
    section.setAttribute('aria-live','off');
    section.innerHTML=`
      <div class="manager-monitor-strip-head">
        <b><i class="manager-monitor-live-dot" aria-hidden="true"></i>实时监控</b>
        <small>本机实时采样 · 不额外请求 D1</small>
      </div>
      <div class="manager-monitor-grid">
        <div class="manager-monitor-cell" data-series="d1" data-state="idle">
          <div class="manager-monitor-meta"><span class="manager-monitor-name"><i></i>D1 响应</span><strong class="manager-monitor-value" data-value="d1">等待请求</strong></div>
          <svg class="manager-monitor-spark" viewBox="0 0 160 25" preserveAspectRatio="none" aria-hidden="true"><path class="manager-monitor-gridline" d="M0 7.5H160M0 17.5H160"/><polyline class="manager-monitor-line" points="0,12.5 160,12.5"/><circle class="manager-monitor-endpoint" cx="160" cy="12.5" r="2"/></svg>
          <span class="manager-monitor-sub" data-sub="d1">记录已有 D1 请求</span>
        </div>
        <div class="manager-monitor-cell" data-series="sync" data-state="idle">
          <div class="manager-monitor-meta"><span class="manager-monitor-name"><i></i>同步状态</span><strong class="manager-monitor-value" data-value="sync">等待验证</strong></div>
          <svg class="manager-monitor-spark" viewBox="0 0 160 25" preserveAspectRatio="none" aria-hidden="true"><path class="manager-monitor-gridline" d="M0 7.5H160M0 17.5H160"/><polyline class="manager-monitor-line" points="0,12.5 160,12.5"/><circle class="manager-monitor-endpoint" cx="160" cy="12.5" r="2"/></svg>
          <span class="manager-monitor-sub" data-sub="sync">读取现有同步状态</span>
        </div>
        <div class="manager-monitor-cell" data-series="lag" data-state="idle">
          <div class="manager-monitor-meta"><span class="manager-monitor-name"><i></i>页面响应</span><strong class="manager-monitor-value" data-value="lag">采样中</strong></div>
          <svg class="manager-monitor-spark" viewBox="0 0 160 25" preserveAspectRatio="none" aria-hidden="true"><path class="manager-monitor-gridline" d="M0 7.5H160M0 17.5H160"/><polyline class="manager-monitor-line" points="0,12.5 160,12.5"/><circle class="manager-monitor-endpoint" cx="160" cy="12.5" r="2"/></svg>
          <span class="manager-monitor-sub" data-sub="lag">页面主线程调度延迟</span>
        </div>
      </div>`;
    return section;
  }
  function ensureStrip(){
    const box=document.getElementById(ROOT_ID);
    if(!box)return;
    const activity=[...box.querySelectorAll('.manager-live-card.wide')].find(card=>card.querySelector('.manager-activity-wrap'));
    if(!activity)return;
    let strip=box.querySelector('.manager-monitor-strip');
    if(!strip){strip=makeStrip();activity.before(strip)}
    updateStrip();
  }
  function attachDashboard(){
    const box=document.getElementById(ROOT_ID);
    if(!box)return false;
    if(!box.dataset.monitorV1996Observed){
      dashboardObserver=new MutationObserver(()=>requestAnimationFrame(ensureStrip));
      dashboardObserver.observe(box,{childList:true});
      box.dataset.monitorV1996Observed='1';
    }
    ensureStrip();
    return true;
  }
  function watchDashboard(){
    if(attachDashboard())return;
    rootObserver=new MutationObserver(()=>{if(attachDashboard()){rootObserver?.disconnect();rootObserver=null}});
    rootObserver.observe(document.documentElement,{childList:true,subtree:true});
  }
  function start(){
    watchD1Requests();
    sampleSync();
    setInterval(()=>{sampleSync();updateStrip()},1200);
    scheduleLagSample();
    watchDashboard();
    refreshTimer=setInterval(updateStrip,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
