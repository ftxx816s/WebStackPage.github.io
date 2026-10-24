
/* Remove text-emoji presentation from mobile toolbar controls without changing behavior. */
(()=>{
  const normalize=()=>{
    const logout=document.getElementById('logoutBtn');if(logout)logout.setAttribute('aria-label','退出登录');
    const theme=document.getElementById('themeBtn');if(theme)theme.dataset.fxIcon='theme';
    const compactTheme=document.getElementById('compactThemeBtn');if(compactTheme)compactTheme.dataset.fxIcon='theme';
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',normalize,{once:true});else normalize();
})();
