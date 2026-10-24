
/* V18.91 · Pre-paint theme bootstrap: apply this device's saved theme before first paint. */
(function(){
  var allowed={dark:1,light:1,liquid:1,neon:1,frosted:1};
  var keys=["fxnav_theme","feitianxiaoxiang_theme_v5","dumbo_theme_v4","dumbo_theme_v3","dumbo_theme_v2","dumbo_theme"];
  var theme="";
  try{
    for(var i=0;i<keys.length;i++){
      var value=localStorage.getItem(keys[i]);
      if(value&&allowed[value]){theme=value;break;}
    }
  }catch(e){}
  if(!allowed[theme]){
    try{theme=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}catch(e){theme="dark";}
  }
  var root=document.documentElement;
  root.setAttribute("data-theme",theme);
  root.classList.add("theme-booting");
  root.style.colorScheme=(theme==="light"||theme==="liquid")?"light":"dark";
  var colors={dark:"#07101d",light:"#edf3ff",liquid:"#c7d3df",neon:"#020713",frosted:"#0b0c0e"};
  root.style.backgroundColor=colors[theme]||colors.dark;
  var meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",colors[theme]||colors.dark);
  window.__FXNAV_BOOT_THEME__=theme;
  window.addEventListener("DOMContentLoaded",function(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        root.classList.remove("theme-booting");
        root.style.backgroundColor="";
      });
    });
  },{once:true});
})();
