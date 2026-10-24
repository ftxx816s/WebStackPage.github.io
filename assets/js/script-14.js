
(()=>{
  const KEY='fxnav_site_doctor_v188';
  const PREV_KEY='fxnav_site_doctor_v187';
  const RUN_KEY='fxnav_site_doctor_runs_v188';
  const BASE_IP_KEY='fxnav_site_doctor_direct_ip_v188';
  const VPN_IP_KEY='fxnav_site_doctor_vpn_ip_v188';
  let resultMap={}, scanning=false, stopRequested=false, currentFilter='all', renderTimer=0;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sitesNow=()=>{try{return typeof allSites==='function'?allSites():[]}catch{return[]}};
  const iconOf=site=>{try{if(typeof getSiteIcon==='function')return getSiteIcon(site)||''}catch{}return site?.icon||site?.iconUrl||''};
  const fmt=t=>{if(!t)return'尚未检测';try{return new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}catch{return'尚未检测'}};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function manualLocked(r){
    return !!(r?.locked===true || (r?.manual===true && /人工确认|手动/.test(String(r?.reason||''))));
  }

  function load(){
    try{
      let raw=localStorage.getItem(KEY);
      if(raw){
        const x=JSON.parse(raw);resultMap=x&&typeof x==='object'?x:{};
        let changed=false;Object.values(resultMap).forEach(r=>{if(r?.code==='dead'&&!manualLocked(r)){r.code='suspect';r.reason=r.reason||'旧版自动失效已降级为疑似失效';changed=true}});if(changed)save();
        return;
      }

      /* 迁移 V18.86：只保留真正“人工确认”的结论。
         旧版本自动判成 VPN 的记录不再锁死，防止拼多多/云盘这类站继续被误分类。 */
      const old=JSON.parse(localStorage.getItem(PREV_KEY)||'{}');
      if(old&&typeof old==='object'){
        Object.values(old).forEach(r=>{
          if(!r?.id)return;
          if(manualLocked(r)){
            let code=r.code;
            if(code==='vpn_candidate') code='pending';
            if(code==='vpn') code='vpnok';
            if(code==='dead_candidate') code='pending';
            resultMap[r.id]={...r,code,locked:true};
          }else{
            /* 自动结果全部回到未检测，让下一次第一轮重新判定。 */
          }
        });
        save();
      }
    }catch{resultMap={}}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(resultMap));document.dispatchEvent(new CustomEvent("fxnav:doctor-update"))}catch{}}
  function runs(){try{const x=JSON.parse(localStorage.getItem(RUN_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function pushRun(type,total){try{const x=runs();x.push({t:Date.now(),type,total});localStorage.setItem(RUN_KEY,JSON.stringify(x.slice(-16)))}catch{}}

  function scheduleRender(force=false){
    if(force){clearTimeout(renderTimer);renderTimer=0;render();return}
    if(renderTimer)return;
    renderTimer=setTimeout(()=>{renderTimer=0;render()},110);
  }

  function normalizeUrl(url){
    try{
      const u=new URL(url);
      if(!/^https?:$/.test(u.protocol))return null;
      return u;
    }catch{return null}
  }

  async function fetchProbe(url,timeout=7600){
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout),start=performance.now();
    try{
      await fetch(url,{
        method:'GET',mode:'no-cors',cache:'no-store',redirect:'follow',
        signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'
      });
      clearTimeout(timer);
      return {ok:true,method:'fetch',ms:Math.max(1,Math.round(performance.now()-start))};
    }catch(err){
      clearTimeout(timer);
      return {ok:false,method:'fetch',ms:Math.max(1,Math.round(performance.now()-start)),error:err?.name==='AbortError'?'timeout':'network'};
    }
  }

  async function imageProbe(src,timeout=4600){
    return await new Promise(resolve=>{
      const img=new Image(),start=performance.now();
      let done=false;
      const finish=(ok,error='')=>{
        if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;
        resolve({ok,method:'image',error,ms:Math.max(1,Math.round(performance.now()-start))});
      };
      const timer=setTimeout(()=>finish(false,'timeout'),timeout);
      img.onload=()=>finish(true);
      img.onerror=()=>finish(false,'image_error');
      img.referrerPolicy='no-referrer';
      img.src=src+(src.includes('?')?'&':'?')+'fxnav_probe='+Date.now();
    });
  }

  const unique=arr=>[...new Set(arr.filter(Boolean))];

  async function browserProbe(site,secondPass=false){
    const raw=site?.url||site,u=normalizeUrl(raw);
    if(!u)return {ok:false,error:'bad_url',reason:'网址格式异常'};

    const httpOnly=location.protocol==='https:'&&u.protocol==='http:';
    const probeU=httpOnly?new URL(u.toString().replace(/^http:/,'https:')):u;

    /* 先测根域，再测原链接。只要浏览器从当前网络拿到响应，就算“能访问”。
       这比看 403/429/5xx 更接近用户真实需求。 */
    const urls=unique([probeU.origin+'/',probeU.toString()]);
    for(const target of urls){
      const p=await fetchProbe(target,secondPass?9000:7600);
      if(p.ok)return {...p,reason:target===probeU.origin+'/'?'站点根域可达':'链接可达'};
    }

    /* 某些网站会专门拒绝脚本 fetch，再用同站资源作第二条阳性证据。 */
    const icons=[];
    try{
      const configured=iconOf(site);
      if(configured){
        const iu=new URL(configured,location.href);
        if(iu.hostname===probeU.hostname)icons.push(iu.toString());
      }
    }catch{}
    icons.push(probeU.origin+'/favicon.ico',probeU.origin+'/apple-touch-icon.png',probeU.origin+'/favicon.png');

    const iconResults=await Promise.all(unique(icons).slice(0,4).map(x=>imageProbe(x,secondPass?6000:4600)));
    const good=iconResults.find(x=>x.ok);
    if(good)return {...good,reason:'站点资源可达'};

    return {
      ok:false,
      error:httpOnly?'http_mixed':'probe_failed',
      reason:httpOnly?'HTTP 网站无法由 HTTPS 页面完整探测':'当前网络未探测到可达响应'
    };
  }

  async function getPublicIp(){
    const apis=[
      ['https://api64.ipify.org?format=json',d=>d.ip],
      ['https://api.ipify.org?format=json',d=>d.ip],
      ['https://ipwho.is/',d=>d.ip]
    ];
    for(const [url,pick] of apis){
      try{
        const c=new AbortController(),t=setTimeout(()=>c.abort(),4500);
        const r=await fetch(url,{cache:'no-store',signal:c.signal,credentials:'omit',referrerPolicy:'no-referrer'});
        clearTimeout(t);
        if(!r.ok)continue;
        const d=await r.json(),ip=pick(d);
        if(ip)return String(ip);
      }catch{}
    }
    return '';
  }
  function maskIp(ip){
    if(!ip)return'';
    if(ip.includes(':'))return ip.split(':').slice(0,3).join(':')+'…';
    const p=ip.split('.');return p.length===4?`${p[0]}.${p[1]}.x.x`:ip;
  }

  async function setDirectBaseline(showToast=true){
    const ip=await getPublicIp();
    if(!ip){
      if(showToast&&typeof toast==='function')toast('没有读取到当前公网出口，请稍后重试');
      return '';
    }
    try{
      localStorage.setItem(BASE_IP_KEY,ip);
      const vpn=localStorage.getItem(VPN_IP_KEY)||'';
      if(vpn===ip)localStorage.removeItem(VPN_IP_KEY);
    }catch{}
    await probeVpnChannel();
    if(showToast&&typeof toast==='function')toast(`已记录当前出口 ${maskIp(ip)} 为直连基线`);
    return ip;
  }

  async function probeVpnChannel(){
    const bar=$('doctorVpnState'),t=$('doctorVpnStateText'),s=$('doctorVpnStateSub');
    if(!bar)return 'unknown';
    bar.classList.remove('online','offline','unknown','direct');
    bar.classList.add('unknown');
    if(t)t.textContent='正在识别当前网络出口…';

    let direct='',vpn='';
    try{
      direct=localStorage.getItem(BASE_IP_KEY)||'';
      vpn=localStorage.getItem(VPN_IP_KEY)||'';
    }catch{}
    const now=await getPublicIp();

    if(!direct){
      bar.classList.remove('unknown');bar.classList.add('unknown');
      if(t)t.textContent='尚未设置直连基线';
      if(s)s.textContent=now
        ?`当前出口 ${maskIp(now)}。关闭代理 / VPN 后点“设当前为直连”，只需设置一次`
        :'暂时没有读取到公网出口';
      bar.dataset.mode='unknown';
      return 'unknown';
    }

    if(now&&now===direct){
      bar.classList.remove('unknown');bar.classList.add('direct');
      if(t)t.textContent='直连模式 · VPN 未启用';
      if(s)s.textContent=`当前出口 ${maskIp(now)} 与直连基线一致，可以进行第一轮`;
      bar.dataset.mode='direct';
      return 'direct';
    }

    if(now&&vpn&&now===vpn){
      bar.classList.remove('unknown');bar.classList.add('online');
      if(t)t.textContent='代理 / VPN 已开启';
      if(s)s.textContent=`当前出口 ${maskIp(now)} 与已记录 VPN 出口一致，可以进行第二轮`;
      bar.dataset.mode='vpn';
      return 'vpn';
    }

    if(now&&now!==direct){
      /* V18.91: 简化识别。
         已有直连基线时，只要当前公网出口变化，就按 VPN/代理出口处理并自动记住。 */
      try{localStorage.setItem(VPN_IP_KEY,now)}catch{}
      bar.classList.remove('unknown');bar.classList.add('online');
      if(t)t.textContent='代理 / VPN 已开启';
      if(s)s.textContent=`直连 ${maskIp(direct)} → 当前 ${maskIp(now)}，出口已切换，可以进行第二轮`;
      bar.dataset.mode='vpn';
      return 'vpn';
    }

    bar.classList.remove('unknown');bar.classList.add('offline');
    if(t)t.textContent='无法确认当前网络出口';
    if(s)s.textContent='请检查网络后刷新状态';
    bar.dataset.mode='offline';
    return 'offline';
  }

  async function ensureDirectMode(){
    let direct='';try{direct=localStorage.getItem(BASE_IP_KEY)||''}catch{}
    if(!direct){
      const ask=typeof uiConfirmV1821==='function'
        ? await uiConfirmV1821('网页不能绕过系统代理或 TUN 强制“直连”。请先关闭代理 / VPN。确认当前已经关闭后，是否把当前出口记录为直连基线并开始第一轮？')
        : window.confirm('网页不能绕过系统代理或 TUN 强制直连。请先关闭代理 / VPN。确认当前已经关闭后，是否把当前出口记录为直连基线并开始第一轮？');
      if(!ask)return false;
      direct=await setDirectBaseline(false);
      if(!direct)return false;
    }
    const mode=await probeVpnChannel();
    if(mode==='direct')return true;
    if(typeof toast==='function')toast('第一轮已阻止：当前不是已记录的直连出口。请关闭代理 / VPN，或重新“设当前为直连”。');
    return false;
  }

  async function ensureVpnMode(){
    const mode=await probeVpnChannel();
    if(mode==='vpn')return true;
    if(mode==='changed'){
      const now=await getPublicIp();
      if(now){
        try{localStorage.setItem(VPN_IP_KEY,now)}catch{}
        await probeVpnChannel();
        return true;
      }
    }
    if(typeof toast==='function')toast('第二轮已阻止：当前仍是直连出口。请先开启代理 / VPN，刷新状态后再检测。');
    return false;
  }

  function statusMeta(code){
    return {
      direct:['direct','正常'],
      pending:['pending','VPN 待测'],
      checking:['checking','检测中'],
      vpnchecking:['vpnchecking','VPN 检测中'],
      vpnok:['vpnok','VPN 下可达'],
      suspect:['dead','疑似失效'],
      dead:['dead','失效']
    }[code]||['pending','未检测'];
  }

  function counts(){
    const ids=new Set(sitesNow().map(s=>s.id)),vals=Object.values(resultMap).filter(r=>ids.has(r.id));
    return {
      direct:vals.filter(r=>r.code==='direct').length,
      pending:vals.filter(r=>r.code==='pending').length,
      checking:vals.filter(r=>['checking','vpnchecking'].includes(r.code)).length,
      vpnok:vals.filter(r=>r.code==='vpnok').length,
      suspect:vals.filter(r=>r.code==='suspect').length,
      dead:vals.filter(r=>r.code==='dead').length,
      total:vals.length
    };
  }

  function updateBadge(){
    const b=document.querySelector('.manager-tab[data-tab="health"] .manager-tab-badge');
    if(!b)return;
    const c=counts(),total=sitesNow().length,unchecked=Math.max(0,total-c.total),actionable=c.pending+c.suspect+c.dead;
    const label=unchecked>0?`未检 ${unchecked}`:`待处理 ${actionable}`;
    b.textContent=label;
    b.title=`未检测 ${unchecked} 个；VPN 待测 ${c.pending} 个；疑似失效 ${c.suspect} 个；已确认失效 ${c.dead} 个。正常与 VPN 下可达不计入待处理；“VPN 下可达”不代表该网站必须使用 VPN。`;
    b.setAttribute('aria-label',label);
    const tab=b.closest('.manager-tab');
    if(tab){tab.title=b.title;tab.setAttribute('aria-label',`网站体检，${label}。${b.title}`)}
  }

  function ensureUI(){
    const tabs=$('managerTabs'),body=document.querySelector('#drawer .drawer-body');
    if(!tabs||!body)return false;
    let tab=tabs.querySelector('[data-tab="health"]');
    if(!tab){
      tab=document.createElement('button');tab.className='manager-tab';tab.type='button';tab.dataset.tab='health';
      tab.innerHTML='网站体检 <span class="manager-tab-badge">0</span>';
      const dataTab=tabs.querySelector('[data-tab="data"]');tabs.insertBefore(tab,dataTab||null);
    }else tab.childNodes[0].textContent='网站体检 ';

    let p=body.querySelector('.manager-panel[data-panel="health"]');
    if(!p){
      p=document.createElement('section');p.className='manager-panel';p.dataset.panel='health';
      const data=body.querySelector('.manager-panel[data-panel="data"]');body.insertBefore(p,data||null);
    }

    if(!p.dataset.v1887){
      p.dataset.v1887='1';
      p.innerHTML=`<div class="site-doctor">
        <div class="manager-panel-title"><div><h3>网站体检</h3><p>不再让你几十个网站逐个确认。第一轮失败的网站自动进入 VPN 待测；开启 VPN 后，第二轮自动一次性复检全部候选。</p></div></div>

        <section class="site-doctor-hero">
          <div class="site-doctor-hero-top">
            <div class="site-doctor-title"><span class="site-doctor-mark">◎</span><div><h3>两轮自动可用性检测</h3><p>第一轮关闭代理 / VPN 检测全部网站：成功=正常，失败=自动进入 VPN 待测。第二轮开启代理 / VPN：自动复检全部待测，成功=VPN 下可达（不等于必须 VPN）；连续复检失败只标记“疑似失效”，人工确认后才进入失效。</p></div></div>
            <div class="site-doctor-last"><span>LAST CHECK</span><b id="doctorLastRun">尚未体检</b></div>
          </div>
          <div class="site-doctor-flow">
            <div class="site-doctor-step"><i>01</i><div><b>直连自动筛查</b><small>关闭 VPN，一键检测全部；失败自动进入 VPN 待测，无需手动添加</small></div></div>
            <div class="site-doctor-step"><i>02</i><div><b>自动生成 VPN 队列</b><small>第一轮所有未探测成功的网站自动集中到第二轮队列</small></div></div>
            <div class="site-doctor-step"><i>03</i><div><b>VPN 一键复检</b><small>开启 VPN 后自动测完整队列；成功保留，连续失败先标记疑似失效</small></div></div>
          </div>
        </section>

        <div class="site-doctor-vpnbar unknown" id="doctorVpnState">
          <i class="lamp"></i>
          <div class="vpn-copy"><b id="doctorVpnStateText">等待识别当前网络出口</b><small id="doctorVpnStateSub">先建立一次直连基线；以后直连=蓝灯，检测到出口变化=自动识别为 VPN 并亮绿灯</small></div>
          <div class="vpn-actions">
            <button class="mini-btn" type="button" id="doctorSetDirect">设当前为直连</button>
            <button class="mini-btn" type="button" id="doctorVpnRefresh">刷新状态</button>
          </div>
        </div>
        <div class="site-doctor-route-warning"><b>路由说明：</b>纯网页无法绕过 Windows 系统代理、浏览器代理或 v2rayN TUN 强制指定“本次请求直连”。因此 V19.20 继续采用严格出口识别：第一轮只允许在已记录的直连出口下运行；第二轮只在检测到 VPN 出口后运行；开启代理后点“刷新状态”即可自动变绿。</div>

        <div class="site-doctor-toolbar">
          <button class="btn primary" type="button" id="doctorScanAll">第一轮：检测全部网站</button>
          <button class="btn vpn" type="button" id="doctorVpnVerify">第二轮：VPN 自动复检</button>
          <button class="btn" type="button" id="doctorStop" hidden>停止</button>
          <div class="site-doctor-progress"><i id="doctorProgressBar"></i></div>
          <span class="site-doctor-progress-text" id="doctorProgressText">尚未检测</span>
          <div class="site-doctor-live-current" id="doctorLiveCurrent"><i></i><span>当前：</span><b>等待开始</b></div>
        </div>

        <div class="site-doctor-summary">
          <div class="site-doctor-stat direct"><span>正常</span><b id="doctorDirect">0</b><small>第一轮直连可用</small></div>
          <div class="site-doctor-stat pending"><span>VPN 待测</span><b id="doctorPending">0</b><small>自动进入第二轮，无需手动添加</small></div>
          <div class="site-doctor-stat vpnok"><span>VPN 下可达</span><b id="doctorVpnOk">0</b><small>仅代表第二轮探测成功，不证明必须 VPN</small></div>
          <div class="site-doctor-stat dead"><span>需确认</span><b id="doctorDead">0</b><small>疑似失效 + 已人工确认失效</small></div>
        </div>

        <div class="site-doctor-subbar">
          <div class="site-doctor-filters" id="doctorFilters">
            <button class="mini-btn" type="button" data-doctor-filter="direct">正常</button>
            <button class="mini-btn" type="button" data-doctor-filter="pending">VPN 待测</button>
            <button class="mini-btn" type="button" data-doctor-filter="vpnok">VPN 下可达</button>
            <button class="mini-btn" type="button" data-doctor-filter="dead">需确认</button>
            <button class="mini-btn active" type="button" data-doctor-filter="all">全部</button>
          </div>
          <div class="site-doctor-auto-note"><i></i><span>检测过程中，下方列表和统计数字会实时同步刷新。</span></div>
        </div>

        <div class="site-doctor-list" id="doctorList"></div>

        <div class="site-doctor-note"><i>!</i><div><b>操作顺序：</b>先关闭 VPN 点第一轮；完成后直接打开 VPN，看到上方状态灯变绿，再点第二轮。你不需要逐个判断，也不需要手动把网站添加到 VPN 区域。</div></div>
      </div>`;

      $('doctorScanAll')?.addEventListener('click',scanDirect);
      $('doctorVpnVerify')?.addEventListener('click',scanVpn);
      $('doctorStop')?.addEventListener('click',()=>{stopRequested=true});
      $('doctorSetDirect')?.addEventListener('click',()=>setDirectBaseline(true));
      $('doctorVpnRefresh')?.addEventListener('click',probeVpnChannel);
      $('doctorFilters')?.addEventListener('click',e=>{
        const b=e.target.closest('[data-doctor-filter]');if(!b)return;
        currentFilter=b.dataset.doctorFilter;
        p.querySelectorAll('[data-doctor-filter]').forEach(x=>x.classList.toggle('active',x===b));
        render();
      });
      $('doctorList')?.addEventListener('click',handleAction);
    }
    updateBadge();return true;
  }

  function filteredRows(){
    const sites=new Map(sitesNow().map(s=>[s.id,s]));
    let arr=Object.values(resultMap).filter(r=>sites.has(r.id));
    const rank={checking:0,vpnchecking:0,suspect:1,dead:1,pending:2,vpnok:3,direct:4};
    arr.sort((a,b)=>(rank[a.code]??9)-(rank[b.code]??9)||String(a.name||'').localeCompare(String(b.name||''),'zh-CN'));
    if(currentFilter==='direct')arr=arr.filter(r=>r.code==='direct');
    else if(currentFilter==='pending')arr=arr.filter(r=>r.code==='pending');
    else if(currentFilter==='vpnok')arr=arr.filter(r=>r.code==='vpnok');
    else if(currentFilter==='dead')arr=arr.filter(r=>r.code==='suspect'||r.code==='dead');
    return arr;
  }

  function evidence(r){
    if(r.code==='checking')return ['正在进行直连检测','结果会实时写入列表'];
    if(r.code==='vpnchecking')return ['正在通过 VPN 复检','第二轮结果会实时更新'];
    if(r.code==='direct')return [`当前网络可访问${r.ms?` · ${r.ms}ms`:''}`,r.reason||'直连正常'];
    if(r.code==='pending')return ['第一轮未探测成功','已自动加入第二轮 VPN 队列'];
    if(r.code==='vpnok')return [`VPN 下可访问${r.ms?` · ${r.ms}ms`:''}`,'需要代理 / VPN 时保留'];
    if(r.code==='suspect')return ['VPN 下连续复检失败','仅标记为疑似失效，请先打开验证，再决定是否确认失效'];
    if(r.code==='dead')return ['已人工确认失效','仍可复检；若实际能用可恢复为正常'];
    return ['尚未检测','等待第一轮'];
  }

  function render(){
    if(!ensureUI())return;
    const c=counts();
    $('doctorDirect')&&($('doctorDirect').textContent=c.direct);
    $('doctorPending')&&($('doctorPending').textContent=c.pending);
    $('doctorVpnOk')&&($('doctorVpnOk').textContent=c.vpnok);
    $('doctorDead')&&($('doctorDead').textContent=c.suspect+c.dead);

    const last=runs().at(-1);
    $('doctorLastRun')&&($('doctorLastRun').textContent=last?`${fmt(last.t)} · ${last.total} 个站点`:'尚未体检');

    const vpnBtn=$('doctorVpnVerify');
    if(vpnBtn)vpnBtn.disabled=scanning||c.pending===0;

    const box=$('doctorList');if(!box)return;
    const rows=filteredRows();
    if(!rows.length){
      box.innerHTML=`<div class="site-doctor-empty">${c.total?'当前筛选区域没有网站。':'还没有检测记录。关闭 VPN 后点“第一轮：检测全部网站”。'}</div>`;
      updateBadge();return;
    }

    const sites=new Map(sitesNow().map(s=>[s.id,s]));
    box.innerHTML=rows.map(r=>{
      const site=sites.get(r.id)||r,[cls,label]=statusMeta(r.code),icon=iconOf(site),ev=evidence(r);
      let actions=`<button class="mini-btn" type="button" data-doctor-act="recheck">复检</button><button class="mini-btn" type="button" data-doctor-act="open">打开验证</button>`;
      if(r.code==='pending')actions+=`<button class="mini-btn restore" type="button" data-doctor-act="direct">设为正常</button>`;
      if(r.code==='vpnok')actions+=`<button class="mini-btn restore" type="button" data-doctor-act="direct">改为直连</button>`;
      if(r.code==='suspect')actions+=`<button class="mini-btn restore" type="button" data-doctor-act="vpnok">实际可用</button><button class="mini-btn danger" type="button" data-doctor-act="dead">确认失效</button>`;
      if(r.code==='dead')actions+=`<button class="mini-btn restore" type="button" data-doctor-act="vpnok">实际可用</button><button class="mini-btn danger" type="button" data-doctor-act="delete">移入回收站</button>`;

      return `<div class="site-doctor-row ${['checking','vpnchecking'].includes(r.code)?'is-checking':''}" data-doctor-id="${esc(r.id)}">
        <div class="site-doctor-site"><span class="site-doctor-icon">${icon?`<img src="${esc(icon)}" alt="">`:'◆'}</span><span class="site-doctor-copy"><b>${esc(site.name||r.name)}</b><small>${esc(r.url)}</small></span></div>
        <div class="site-doctor-state ${cls}"><i></i><span>${label}</span></div>
        <div class="site-doctor-evidence"><b>${esc(ev[0])}</b><small>${esc(ev[1])} · ${fmt(r.checkedAt)}</small></div>
        <div class="site-doctor-actions">${actions}</div>
      </div>`;
    }).join('');
    updateBadge();
  }

  function setLive(name='等待开始'){
    const b=$('doctorLiveCurrent')?.querySelector('b');if(b)b.textContent=name;
  }
  function setProgress(done,total,msg='',current=''){
    const pct=total?Math.round(done/total*100):0;
    const bar=$('doctorProgressBar'),tx=$('doctorProgressText');
    if(bar)bar.style.width=pct+'%';
    if(tx)tx.textContent=msg||`${done}/${total} · ${pct}%`;
    if(current)setLive(current);
  }
  function setBusy(on){
    scanning=on;
    ['doctorScanAll','doctorVpnVerify','doctorVpnRefresh'].forEach(id=>{const e=$(id);if(e)e.disabled=on});
    const stop=$('doctorStop');if(stop)stop.hidden=!on;
  }

  async function runPool(sites,worker,label){
    let cursor=0,done=0;
    const n=Math.min(6,sites.length);
    const jobs=Array.from({length:n},async()=>{
      while(cursor<sites.length&&!stopRequested){
        const site=sites[cursor++];
        setProgress(done,sites.length,`${label} ${done}/${sites.length}`,site.name||site.url);
        await worker(site);
        done++;
        setProgress(done,sites.length,`${label} ${done}/${sites.length}`,site.name||site.url);
        scheduleRender();
        if(done%10===0)save();
      }
    });
    await Promise.all(jobs);
    return done;
  }

  async function scanDirect(){
    if(scanning)return;
    load();
    const sites=sitesNow();
    if(!sites.length){if(typeof toast==='function')toast('没有网站可检测');return}

    if(!(await ensureDirectMode()))return;

    /* 第一轮每次都是重新体检。只保留用户手工锁定的修正结果。 */
    const locked={};
    Object.values(resultMap).forEach(r=>{if(manualLocked(r))locked[r.id]=r});
    resultMap=locked;
    save();
    scheduleRender(true);

    setBusy(true);stopRequested=false;currentFilter='all';
    document.querySelectorAll('#doctorFilters [data-doctor-filter]').forEach(x=>x.classList.toggle('active',x.dataset.doctorFilter==='all'));
    setProgress(0,sites.length,'第一轮 · 直连检测','准备记录直连出口…');


    let directIp='';try{directIp=localStorage.getItem(BASE_IP_KEY)||''}catch{}
    const bar=$('doctorVpnState'),t=$('doctorVpnStateText'),s=$('doctorVpnStateSub');
    if(bar){bar.classList.remove('online','offline','unknown');bar.classList.add('direct');bar.dataset.mode='direct'}
    if(t)t.textContent='直连模式 · 第一轮';
    if(s)s.textContent=directIp?`当前使用已确认直连出口 ${maskIp(directIp)}；第一轮不会在 VPN 状态下启动`:'正在使用直连模式';

    const done=await runPool(sites,async site=>{
      const old=resultMap[site.id];
      if(manualLocked(old))return;

      resultMap[site.id]={id:site.id,name:site.name,url:site.url,code:'checking',checkedAt:Date.now(),stage:1};
      scheduleRender();

      const p=await browserProbe(site,false);
      resultMap[site.id]={
        id:site.id,name:site.name,url:site.url,
        category:(typeof effectiveCategory==='function'?effectiveCategory(site):site.category)||'',
        code:p.ok?'direct':'pending',
        ms:p.ms||0,reason:p.reason||'',checkedAt:Date.now(),stage:1,locked:false
      };
      scheduleRender();
    },'直连检测');

    save();pushRun('direct',done);setBusy(false);scheduleRender(true);
    setProgress(done,sites.length,stopRequested?'已停止':'第一轮完成',stopRequested?'已停止':`已自动生成 ${counts().pending} 个 VPN 待测网站`);
    if(typeof toast==='function')toast(stopRequested?'检测已停止':`第一轮完成：${counts().pending} 个网站已自动进入 VPN 第二轮`);
  }

  async function scanVpn(){
    if(scanning)return;
    load();
    const pendingIds=new Set(Object.values(resultMap).filter(r=>r.code==='pending').map(r=>r.id));
    const sites=sitesNow().filter(s=>pendingIds.has(s.id));
    if(!sites.length){if(typeof toast==='function')toast('没有需要第二轮复检的网站');return}

    const channel=await ensureVpnMode();
    if(!channel)return;

    setBusy(true);stopRequested=false;currentFilter='all';
    document.querySelectorAll('#doctorFilters [data-doctor-filter]').forEach(x=>x.classList.toggle('active',x.dataset.doctorFilter==='all'));
    setProgress(0,sites.length,'第二轮 · VPN 复检','开始检测 VPN 队列…');

    const done=await runPool(sites,async site=>{
      const prev=resultMap[site.id]||{};
      resultMap[site.id]={...prev,code:'vpnchecking',checkedAt:Date.now(),stage:2};
      scheduleRender();

      let p=await browserProbe(site,true);

      /* VPN 下第一次失败，再等一下做第二次完整复检，减少临时网络波动造成的假失效。 */
      if(!p.ok&&!stopRequested){
        await sleep(650);
        p=await browserProbe(site,true);
      }

      resultMap[site.id]={
        ...prev,id:site.id,name:site.name,url:site.url,
        code:p.ok?'vpnok':'suspect',
        ms:p.ms||0,reason:p.reason||'',checkedAt:Date.now(),stage:2,locked:false
      };
      scheduleRender();
    },'VPN 复检');

    save();pushRun('vpn',done);setBusy(false);scheduleRender(true);
    setProgress(done,sites.length,stopRequested?'已停止':'第二轮完成',stopRequested?'已停止':`VPN 下可达 ${counts().vpnok} · 疑似失效 ${counts().suspect} · 已确认失效 ${counts().dead}`);
    if(typeof toast==='function')toast(stopRequested?'VPN 复检已停止':`第二轮完成：VPN 下可达 ${counts().vpnok}，疑似失效 ${counts().suspect}`);
  }

  async function recheckOne(site){
    const prev=resultMap[site.id]||{};
    const vpnMode=['pending','vpnok','suspect','dead'].includes(prev.code);
    if(vpnMode&&prev.code==='pending'){
      const channel=await ensureVpnMode();
      if(!channel)return;
    }
    resultMap[site.id]={...prev,code:vpnMode?'vpnchecking':'checking',checkedAt:Date.now()};
    scheduleRender(true);
    let p=await browserProbe(site,vpnMode);
    if(vpnMode&&!p.ok){await sleep(500);p=await browserProbe(site,true)}
    resultMap[site.id]={...prev,id:site.id,name:site.name,url:site.url,code:p.ok?(vpnMode?'vpnok':'direct'):(vpnMode?'suspect':'pending'),ms:p.ms||0,reason:p.reason||'',checkedAt:Date.now(),locked:false};
    save();scheduleRender(true);
  }

  async function handleAction(e){
    const btn=e.target.closest('[data-doctor-act]');if(!btn)return;
    const row=btn.closest('[data-doctor-id]'),id=row?.dataset.doctorId,site=sitesNow().find(s=>s.id===id);
    if(!site)return;
    const act=btn.dataset.doctorAct,prev=resultMap[id]||{id,name:site.name,url:site.url};

    if(act==='open'){window.open(site.url,'_blank','noopener');return}
    if(act==='recheck'){await recheckOne(site);return}

    if(act==='direct'){
      resultMap[id]={...prev,code:'direct',checkedAt:Date.now(),locked:true,manual:true,reason:'人工确认直连正常'};
      save();scheduleRender(true);if(typeof toast==='function')toast(`「${site.name}」已锁定为直连正常`);
      return;
    }

    if(act==='vpnok'){
      resultMap[id]={...prev,code:'vpnok',checkedAt:Date.now(),locked:true,manual:true,reason:'人工确认实际可用'};
      save();scheduleRender(true);if(typeof toast==='function')toast(`「${site.name}」已恢复为可用`);
      return;
    }

    if(act==='dead'){
      if(typeof uiConfirmV1821==='function'&&!(await uiConfirmV1821(`已人工打开验证「${site.name}」仍无法访问，确认标记为失效？`)))return;
      resultMap[id]={...prev,code:'dead',checkedAt:Date.now(),locked:true,manual:true,reason:'人工确认失效'};
      save();scheduleRender(true);if(typeof toast==='function')toast(`「${site.name}」已确认失效`);
      return;
    }

    if(act==='delete'){
      if(typeof uiConfirmV1821==='function'&&!(await uiConfirmV1821(`确定将「${site.name}」移入回收站？`)))return;
      if(typeof deleteContextSite==='function')await deleteContextSite(site);else return;
      delete resultMap[id];save();scheduleRender(true);
    }
  }

  load();
  const obs=new MutationObserver(()=>{
    if(ensureUI()){render();probeVpnChannel();obs.disconnect()}
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.manager-tab');
    if(tab?.dataset.tab==='health')setTimeout(()=>{render();probeVpnChannel()},0);
    const quick=e.target.closest?.('[data-go="health"]');
    if(quick)setTimeout(()=>{ensureUI();render();probeVpnChannel()},0);
  },{passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{ensureUI();render();probeVpnChannel()},{once:true});
  }else{
    ensureUI();render();probeVpnChannel();
  }
})();
