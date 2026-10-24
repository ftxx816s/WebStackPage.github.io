
(()=>{
  const CAL_KEY='fxnav_mobile_calendar_open_v1892';
  function ensureCalendarToggle(){
    const cal=document.querySelector('.hero-datetime');
    if(!cal||document.getElementById('mobileCalendarToggleV1892'))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='mobileCalendarToggleV1892';
    btn.className='mobile-calendar-toggle';
    btn.setAttribute('aria-controls','calendarDays');
    const open=(()=>{try{return localStorage.getItem(CAL_KEY)==='1'}catch{return false}})();
    cal.classList.toggle('mobile-calendar-collapsed',!open);
    const sync=()=>{
      const expanded=!cal.classList.contains('mobile-calendar-collapsed');
      btn.setAttribute('aria-expanded',String(expanded));
      btn.innerHTML=(expanded?'收起月历':'展开月历')+' <span aria-hidden="true">⌄</span>';
    };
    btn.addEventListener('click',()=>{
      cal.classList.toggle('mobile-calendar-collapsed');
      const expanded=!cal.classList.contains('mobile-calendar-collapsed');
      try{localStorage.setItem(CAL_KEY,expanded?'1':'0')}catch{}
      sync();
    });
    const top=cal.querySelector('.calendar-ref-top');
    if(top)top.after(btn);else cal.prepend(btn);
    sync();
  }

  function improveLabels(){
    const labels={
      closeDrawer:'关闭管理中心',closeSiteEditor:'关闭网站编辑',manageBtn:'打开管理中心',compactManageBtn:'打开管理中心',
      sortModeBtn:'调整网站排序',compactSortBtn:'调整网站排序',densityBtn:'切换卡片密度',compactDensityBtn:'切换卡片密度',
      themeBtn:'切换主题',compactThemeBtn:'切换主题',mobileMenuBtn:'打开分类菜单'
    };
    Object.entries(labels).forEach(([id,label])=>{
      const el=document.getElementById(id);if(!el)return;
      if(!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);
      if(!el.getAttribute('title'))el.setAttribute('title',label);
    });
    const search=document.getElementById('searchInput');if(search&&!search.getAttribute('aria-label'))search.setAttribute('aria-label','搜索网站、域名或关键词');
    const close=document.getElementById('closeDrawer');if(close)close.textContent='×';
  }

  /* 最终包装当前 createCard：只增加移动端可见 ⋯，原卡片结构、收藏与点击逻辑全部保留。 */
  if(typeof createCard==='function'&&!createCard.__v1893){
    const base=createCard;
    const wrapped=function(site){
      const card=base(site);
      if(card&&!card.querySelector('.card-more')){
        const more=document.createElement('button');
        more.type='button';more.className='card-more';more.textContent='⋯';
        more.title='更多操作';more.setAttribute('aria-label',`${site?.name||'网站'}更多操作`);
        more.addEventListener('click',e=>{
          e.preventDefault();e.stopPropagation();
          const r=more.getBoundingClientRect();
          if(typeof openCategoryContext==='function')openCategoryContext({clientX:r.right-6,clientY:r.bottom+4},site);
        });
        card.append(more);
      }
      return card;
    };
    wrapped.__v1893=true;
    createCard=wrapped;
  }


  /* 统计同步改为显式更新入口，不再依赖“盯着数字变化”的额外 DOM 观察器。 */
  try{
    if(typeof updateCounts==='function'&&!updateCounts.__v1893){
      const baseCounts=updateCounts;
      const wrappedCounts=function(...args){const r=baseCounts.apply(this,args);try{if(typeof renderManagerMetrics==='function')renderManagerMetrics()}catch{}return r};
      wrappedCounts.__v1893=true;updateCounts=wrappedCounts;
    }
  }catch{}

  function setup(){
    ensureCalendarToggle();
    improveLabels();
    try{if(typeof updateCounts==='function')updateCounts()}catch{}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
