
/* VisualViewport fallback for older mobile browsers and dynamic address bars. */
(()=>{
  let raf=0,last=0;
  const apply=()=>{raf=0;const h=Math.round(window.visualViewport?.height||window.innerHeight||0);if(h&&Math.abs(h-last)>1){last=h;document.documentElement.style.setProperty('--fx-app-height',h+'px')}};
  const queue=()=>{if(!raf)raf=requestAnimationFrame(apply)};
  apply();
  window.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(queue,80),{passive:true});
  window.visualViewport?.addEventListener('resize',queue,{passive:true});
})();
