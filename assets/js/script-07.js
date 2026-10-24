
/* V18.10 UI-only helper: the Liquid Glass search capsule focuses the existing search input. */
(()=>{
  const btn=document.getElementById("liquidSearchBtn");
  const input=document.getElementById("searchInput");
  btn?.addEventListener("click",()=>{input?.focus({preventScroll:true});input?.select?.()});
})();

/* ===================== V18.15 · Interaction Performance / No Visual Change =====================
   UI CSS and all three theme effects are intentionally unchanged.
   Optimizations target click-frame storage work, manager hydration, drag listeners, and pointer layout reads.
*/
