
(()=>{
  let timer=0;
  const markScrolling=()=>{
    document.body.classList.add("sidebar-is-scrolling");
    clearTimeout(timer);
    timer=setTimeout(()=>{
      document.body.classList.remove("sidebar-is-scrolling");
      /* Force one clean repaint of the sidebar after the scroll settles. */
      const sidebar=document.getElementById("sidebar");
      if(sidebar){
        sidebar.style.transform="translateZ(0)";
        requestAnimationFrame(()=>{ sidebar.style.transform=""; });
      }
    },140);
  };

  window.addEventListener("scroll",markScrolling,{passive:true});
  const sidebar=document.getElementById("sidebar");
  if(sidebar){
    sidebar.addEventListener("scroll",markScrolling,{passive:true});
    sidebar.addEventListener("wheel",markScrolling,{passive:true});
    sidebar.addEventListener("touchmove",markScrolling,{passive:true});
  }
})();
