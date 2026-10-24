
(()=>{
  const $=id=>document.getElementById(id);
  const SYNC_KEY='fxnav_manager_last_sync_v1831';
  const ACT_KEY='fxnav_manager_activity_v1831';
  const fmtTime=t=>{if(!t)return '--:--';try{return new Date(Number(t)).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false})}catch{return '--:--'}};
  const cacheKB=()=>{try{let total=0;for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';const v=localStorage.getItem(k)||'';total+=(k.length+v.length)*2}return Math.max(0,Math.round(total/1024))}catch{return 0}};
  const activityCounts=()=>{try{const rows=JSON.parse(localStorage.getItem(ACT_KEY)||'[]');const now=Date.now(),bucket=4*60*60*1000,vals=[0,0,0,0,0,0];if(Array.isArray(rows))rows.forEach(r=>{const d=now-Number(r?.t||0);if(d>=0&&d<24*60*60*1000){const idx=5-Math.floor(d/bucket);if(idx>=0&&idx<6)vals[idx]++}});return vals}catch{return [0,0,0,0,0,0]}};
  const buildWaveLoop=()=>{
    const vals=activityCounts(),max=Math.max(1,...vals),mid=15,w=180,h=28;
    const norm=vals.map(v=>v/max);
    const shape=[
      [0,mid],[16,mid],[22,mid-2],[28,mid],[35,mid],[42,mid-3],[48,mid+2],
      [55,mid-8-(norm[1]||0)*4],[60,mid+7],[66,mid-3],[72,mid],[87,mid],
      [98,mid-2-(norm[2]||0)*3],[106,mid],[118,mid],[127,mid-5-(norm[3]||0)*4],
      [133,mid+4],[139,mid-2],[147,mid],[158,mid],[166,mid-3-(norm[4]||0)*3],
      [174,mid],[180,mid]
    ];
    const points=[];
    for(let r=0;r<3;r++){
      const base=r*w;
      shape.forEach(([x,y],i)=>{
        if(r>0 && i===0)return;
        points.push([x+base,Math.max(2,Math.min(h-2,y))]);
      });
    }
    const line='M '+points.map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
    const area=`M 0 ${h} L `+points.map(([x,y])=>`${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')+` L ${w*3} ${h} Z`;
    return {line,area};
  };
  const drawWave=()=>{
    const wave=buildWaveLoop();
    const line=$('consoleWaveLineA'),area=$('consoleWaveAreaA');
    if(line)line.setAttribute('d',wave.line);
    if(area)area.setAttribute('d',wave.area);
    ['consoleWaveLineB','consoleWaveAreaB'].forEach(id=>{const el=$(id);if(el)el.setAttribute('d','')});
  };
  const render=()=>{
    const rev=Math.max(0,Number(window.V17?.revision)||0);
    const sync=Number(localStorage.getItem(SYNC_KEY)||window.V17?.lastPullAt||0);
    const cloud=$('cloudStatusText')?.textContent?.trim()||'';
    const healthy=navigator.onLine && (/已同步|同步|正常|ready|成功|在线/i.test(cloud)||!!window.V17?.ready);
    if($('consoleRevision'))$('consoleRevision').textContent=window.V17?.ready?String(rev):'—';
    if($('consoleSync'))$('consoleSync').textContent=fmtTime(sync);
    if($('consoleCache'))$('consoleCache').textContent=cacheKB()+' KB';
    if($('consoleHealthText'))$('consoleHealthText').textContent=healthy?'PRIVATE NAV · HEALTHY':(navigator.onLine?'PRIVATE NAV · CONNECTING':'PRIVATE NAV · OFFLINE');
    if($('consolePulse')){$('consolePulse').style.background=healthy?'var(--good)':'#ffb86b';$('consolePulse').style.boxShadow=healthy?'0 0 0 3px rgba(85,214,166,.10)':'0 0 0 3px rgba(255,184,107,.10)'}
    drawWave();
  };
  const bind=()=>{render();const cloud=$('cloudStatusText');if(cloud)new MutationObserver(render).observe(cloud,{childList:true,subtree:true,characterData:true});window.addEventListener('online',render,{passive:true});window.addEventListener('offline',render,{passive:true});setInterval(render,30000)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
