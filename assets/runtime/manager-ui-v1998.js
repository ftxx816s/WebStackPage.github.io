/* V19.98 · Unified liquid controls for the manager drawer.
   Native selects remain the form/data source; this layer only replaces their browser-specific UI. */
(()=>{
  'use strict';
  const ROOT='#drawer';
  const SELECT='select:not([multiple]):not([size])';
  let active=null,serial=0,observer=null;

  const textOf=option=>String(option?.textContent||'').replace(/\s+/g,' ').trim();
  const selectedIndex=select=>Math.max(0,select.selectedIndex>=0?select.selectedIndex:0);
  const selectedText=select=>textOf(select.options[selectedIndex(select)])||'请选择';
  const labelFor=select=>{
    const explicit=select.getAttribute('aria-label');
    if(explicit)return explicit;
    if(select.id){
      const label=document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
      if(label)return textOf(label);
    }
    const parent=select.closest('.field');
    const label=parent?.querySelector('label');
    return label?textOf(label):selectedText(select);
  };

  function refresh(select){
    const wrapper=select?.closest('.liquid-select');
    if(!wrapper)return;
    const trigger=wrapper.querySelector('.liquid-select-trigger');
    const value=wrapper.querySelector('.liquid-select-value');
    if(value)value.textContent=selectedText(select);
    if(trigger){
      trigger.disabled=!!select.disabled;
      trigger.setAttribute('aria-label',labelFor(select));
      trigger.title=selectedText(select);
    }
    if(active?.select===select)renderOptions(select,active.menu);
  }

  function renderOptions(select,menu){
    if(!menu)return;
    const fragment=document.createDocumentFragment();
    Array.from(select.options).forEach((option,index)=>{
      const item=document.createElement('button');
      item.type='button';
      item.className='liquid-select-option';
      item.setAttribute('role','option');
      item.setAttribute('aria-selected',String(index===select.selectedIndex));
      item.disabled=!!option.disabled;
      item.dataset.index=String(index);
      item.textContent=textOf(option)||'—';
      item.addEventListener('click',()=>choose(select,index));
      fragment.append(item);
    });
    menu.replaceChildren(fragment);
  }

  function position(){
    if(!active?.menu?.isConnected||!active.trigger?.isConnected)return;
    const {trigger,menu}=active;
    const rect=trigger.getBoundingClientRect();
    const width=Math.min(Math.max(rect.width,168),Math.max(168,window.innerWidth-16));
    const maxHeight=Math.min(280,Math.max(150,window.innerHeight*.46));
    const below=window.innerHeight-rect.bottom;
    const above=rect.top;
    const side=below<Math.min(220,maxHeight)&&above>below?'top':'bottom';
    const left=Math.max(8,Math.min(rect.left,window.innerWidth-width-8));
    menu.dataset.side=side;
    menu.style.left=`${left}px`;
    menu.style.width=`${width}px`;
    menu.style.maxHeight=`${maxHeight}px`;
    menu.style.top=side==='bottom'?`${Math.min(window.innerHeight-maxHeight-8,rect.bottom+6)}px`:'auto';
    menu.style.bottom=side==='top'?`${Math.max(8,window.innerHeight-rect.top+6)}px`:'auto';
  }

  function close(restoreFocus=false){
    if(!active)return;
    const {trigger,menu}=active;
    menu?.remove();
    trigger?.setAttribute('aria-expanded','false');
    active=null;
    if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
  }

  function choose(select,index){
    const option=select.options[index];
    if(!option||option.disabled||select.disabled)return;
    const changed=select.selectedIndex!==index;
    select.selectedIndex=index;
    refresh(select);
    close(false);
    if(changed){
      select.dispatchEvent(new Event('input',{bubbles:true}));
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function open(select,trigger){
    if(select.disabled)return;
    if(active?.select===select){close(false);return}
    close(false);
    const menu=document.createElement('div');
    menu.className='liquid-select-menu';
    menu.setAttribute('role','listbox');
    menu.setAttribute('aria-label',labelFor(select));
    menu.id=`liquid-select-menu-${++serial}`;
    trigger.setAttribute('aria-controls',menu.id);
    trigger.setAttribute('aria-expanded','true');
    renderOptions(select,menu);
    document.body.append(menu);
    active={select,trigger,menu};
    position();
    requestAnimationFrame(()=>{
      const chosen=menu.querySelector('[aria-selected="true"]:not(:disabled)')||menu.querySelector('.liquid-select-option:not(:disabled)');
      chosen?.focus({preventScroll:true});
    });
  }

  function enhance(select){
    if(!(select instanceof HTMLSelectElement)||select.multiple||select.size>1||select.dataset.liquidEnhanced==='1')return;
    if(!select.closest(ROOT))return;
    const wrapper=document.createElement('div');
    wrapper.className='liquid-select';
    wrapper.dataset.liquidSelect='1';
    select.parentNode.insertBefore(wrapper,select);
    wrapper.append(select);
    select.dataset.liquidEnhanced='1';
    select.classList.add('liquid-select-native');
    select.tabIndex=-1;
    select.setAttribute('aria-hidden','true');

    const trigger=document.createElement('button');
    trigger.type='button';
    trigger.className='liquid-select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label',labelFor(select));
    const value=document.createElement('span');
    value.className='liquid-select-value';
    const caret=document.createElement('span');
    caret.className='liquid-select-caret';
    caret.setAttribute('aria-hidden','true');
    trigger.append(value,caret);
    wrapper.append(trigger);

    trigger.addEventListener('click',()=>open(select,trigger));
    trigger.addEventListener('keydown',event=>{
      if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){
        event.preventDefault();
        if(!active||active.select!==select)open(select,trigger);
      }
    });
    select.addEventListener('change',()=>refresh(select));
    refresh(select);
  }

  function handleMenuKeys(event){
    if(!active)return;
    const items=[...active.menu.querySelectorAll('.liquid-select-option:not(:disabled)')];
    if(!items.length)return;
    const current=items.indexOf(document.activeElement);
    let next=current;
    if(event.key==='ArrowDown')next=Math.min(items.length-1,current+1);
    else if(event.key==='ArrowUp')next=Math.max(0,current<0?0:current-1);
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=items.length-1;
    else if(event.key==='Escape'){event.preventDefault();close(true);return}
    else if(event.key==='Tab'){close(false);return}
    else return;
    event.preventDefault();items[next]?.focus({preventScroll:true});
  }

  function scan(node=document){
    if(node.nodeType!==1&&node!==document)return;
    if(node.matches?.(`${ROOT} ${SELECT}`))enhance(node);
    node.querySelectorAll?.(`${ROOT} ${SELECT}`).forEach(enhance);
    if(node.matches?.(`${ROOT} .liquid-select-native`))refresh(node);
    node.querySelectorAll?.(`${ROOT} .liquid-select-native`).forEach(refresh);
  }

  document.addEventListener('pointerdown',event=>{
    if(!active)return;
    if(active.menu.contains(event.target)||active.trigger.contains(event.target))return;
    close(false);
  },true);
  document.addEventListener('keydown',handleMenuKeys,true);
  window.addEventListener('resize',position,{passive:true});
  window.addEventListener('scroll',()=>{if(active)position()},{passive:true,capture:true});

  function start(){
    scan(document);
    if(observer)return;
    observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='childList'){
          record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node)});
          if(record.target instanceof HTMLSelectElement)refresh(record.target);
          else if(record.target instanceof HTMLOptionElement)refresh(record.target.closest('select'));
          if(active&&!active.select.isConnected)close(false);
        }else if(record.type==='attributes'){
          const target=record.target;
          if(target instanceof HTMLSelectElement)refresh(target);
          else if(target instanceof HTMLOptionElement)refresh(target.closest('select'));
        }
      }
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','selected','aria-label']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
