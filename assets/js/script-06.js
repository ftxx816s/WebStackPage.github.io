
/* ===================== V18.7 · Precision Clock Calendar Runtime ===================== */
(function(){
  const $id=id=>document.getElementById(id);
  const pad=n=>String(n).padStart(2,"0");
  const weekdayLong=["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
  const weekdayShort=["日","一","二","三","四","五","六"];

  let calendarCursor=new Date();
  let calendarSelected=new Date();
  let userBrowsingMonth=false;
  let tickTimer=0;
  let lastDateKey="";
  let lastZoneKey="";

  const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const monthKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;

  function sameDate(a,b){
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  }

  function sameMonth(a,b){
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth();
  }

  function zoneLabel(now){
    let zone="";
    try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{}
    const offset=-now.getTimezoneOffset();
    const sign=offset>=0?"+":"-";
    const h=Math.floor(Math.abs(offset)/60);
    const min=Math.abs(offset)%60;
    const gmt=`GMT${sign}${h}${min?":"+pad(min):""}`;
    if(!zone)return gmt;
    const short=zone.split("/").pop()?.replaceAll("_"," ")||zone;
    return `${short} · ${gmt}`;
  }

  function lunarLabel(date){
    try{
      const lunar=new Intl.DateTimeFormat("zh-CN-u-ca-chinese",{
        month:"long",day:"numeric"
      }).format(date);
      if(lunar && !/^\d/.test(lunar))return `农历 ${lunar}`;
    }catch{}
    return "";
  }


  const lunarFestivalFormatter=(()=>{
    try{return new Intl.DateTimeFormat("zh-CN-u-ca-chinese",{month:"long",day:"numeric"})}catch{return null}
  })();

  function lunarFestivalParts(date){
    if(!lunarFestivalFormatter)return null;
    try{
      const parts=lunarFestivalFormatter.formatToParts(date);
      const month=parts.find(p=>p.type==="month")?.value||"";
      const day=Number(parts.find(p=>p.type==="day")?.value||0);
      if(!month||!day)return null;
      return {month,day};
    }catch{return null}
  }

  function qingmingDay(year){
    if(year<2000||year>2099)return 4;
    const y=year%100;
    return Math.floor(y*0.2422+4.81)-Math.floor(y/4);
  }

  function holidayInfo(date){
    const names=[];
    const short=[];
    const month=date.getMonth()+1;
    const day=date.getDate();

    const solarKey=`${month}-${day}`;
    const solar={
      "1-1":["元旦","元旦"],
      "5-1":["劳动节","劳动"],
      "10-1":["国庆节","国庆"]
    };
    if(solar[solarKey]){
      names.push(solar[solarKey][0]);
      short.push(solar[solarKey][1]);
    }
    if(month===4 && day===qingmingDay(date.getFullYear())){
      names.push("清明节"); short.push("清明");
    }

    const lunar=lunarFestivalParts(date);
    if(lunar && !/^闰/.test(lunar.month)){
      const lk=`${lunar.month}-${lunar.day}`;
      const festivals={
        "正月-1":["春节","春节"],
        "正月-15":["元宵节","元宵"],
        "五月-5":["端午节","端午"],
        "八月-15":["中秋节","中秋"],
        "九月-9":["重阳节","重阳"],
        "腊月-8":["腊八节","腊八"],
        "腊月-23":["小年","小年"]
      };
      if(festivals[lk]){
        names.push(festivals[lk][0]);
        short.push(festivals[lk][1]);
      }

      if(lunar.month==="腊月"){
        const next=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1);
        const np=lunarFestivalParts(next);
        if(np?.month==="正月" && np.day===1){
          names.push("除夕"); short.push("除夕");
        }
      }
    }

    if(!names.length)return null;
    return {
      name:[...new Set(names)].join(" · "),
      short:[...new Set(short)].join("/"),
      major:names.some(n=>["春节","国庆节","中秋节","元旦","劳动节","清明节","端午节"].includes(n))
    };
  }

  function selectedInfoText(date){
    const lunar=lunarLabel(date);
    const holiday=holidayInfo(date);
    return `${date.getMonth()+1}月${date.getDate()}日 · ${weekdayLong[date.getDay()]}${holiday?" · "+holiday.name:""}${lunar?" · "+lunar:""}`;
  }

  function updateSelectedInfo(){
    const el=$id("calendarSelectedInfo");
    if(el)el.textContent=selectedInfoText(calendarSelected);

    const main=$id("selectedDateMain");
    if(main){
      const holiday=holidayInfo(calendarSelected);
      const day=calendarSelected.getDay();
      const status=holiday?.name || ((day===0||day===6) ? "周末" : "工作日");
      main.textContent=status;
      main.dataset.kind=holiday ? "holiday" : ((day===0||day===6) ? "weekend" : "workday");
      main.title=holiday ? `${holiday.name} · ${calendarSelected.getMonth()+1}月${calendarSelected.getDate()}日` : status;
    }
  }

  function updateTodayButton(){
    const btn=$id("calendarTodayBtn");
    if(!btn)return;
    const now=new Date();
    const atToday=sameDate(calendarSelected,now)&&sameMonth(calendarCursor,now);
    btn.classList.toggle("is-today",atToday);
    btn.setAttribute("aria-pressed",atToday?"true":"false");
  }

  function updateClock(){
    const now=new Date();
    const hm=$id("clockHourMinute");
    const sec=$id("clockSecond");
    const date=$id("clockDateText");
    const zone=$id("clockZoneText");

    if(hm)hm.textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if(sec)sec.textContent=pad(now.getSeconds());
    if(date){
      const holiday=holidayInfo(now);
      date.textContent=`${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 · ${weekdayLong[now.getDay()]}${holiday?" · "+holiday.name:""}`;
    }

    const dayBig=$id("currentDayBig");
    const monthShort=$id("currentMonthShort");
    const yearText=$id("currentYearText");
    const weekdayText=$id("currentWeekdayText");
    if(dayBig)dayBig.textContent=pad(now.getDate());
    if(monthShort)monthShort.textContent=`${now.getMonth()+1}月`;
    if(yearText)yearText.textContent=now.getFullYear();
    if(weekdayText)weekdayText.textContent=weekdayLong[now.getDay()];

    const hourDeg=((now.getHours()%12)+(now.getMinutes()/60))*30;
    const minuteDeg=(now.getMinutes()+(now.getSeconds()/60))*6;
    const secondDeg=(now.getSeconds()+(now.getMilliseconds()/1000))*6;
    const hourHand=$id("analogHourHand"), minuteHand=$id("analogMinuteHand"), secondHand=$id("analogSecondHand");
    if(hourHand)hourHand.style.transform=`translateX(-50%) rotate(${hourDeg}deg)`;
    if(minuteHand)minuteHand.style.transform=`translateX(-50%) rotate(${minuteDeg}deg)`;
    if(secondHand)secondHand.style.transform=`translateX(-50%) rotate(${secondDeg}deg)`;

    const elapsed=((now.getHours()*3600)+(now.getMinutes()*60)+now.getSeconds())/86400;
    const progress=Math.max(0,Math.min(100,elapsed*100));
    const progressBar=$id("dayProgressBar"), progressText=$id("dayProgressText");
    if(progressBar)progressBar.style.width=`${progress.toFixed(2)}%`;
    if(progressText)progressText.textContent=`${Math.round(progress)}%`;

    const zk=`${now.getTimezoneOffset()}|${Intl.DateTimeFormat().resolvedOptions().timeZone||""}`;
    if(zone && zk!==lastZoneKey){
      zone.textContent=zoneLabel(now);
      lastZoneKey=zk;
    }

    const dk=dateKey(now);
    if(dk!==lastDateKey){
      const wasViewingCurrentMonth=sameMonth(calendarCursor,new Date(now.getFullYear(),now.getMonth(),1));
      lastDateKey=dk;

      if(!userBrowsingMonth && wasViewingCurrentMonth){
        calendarSelected=new Date(now);
        calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);
        renderCalendar(false);
      }else{
        renderCalendar(false);
      }
      updateTodayButton();
    }
  }

  function scheduleTick(){
    clearTimeout(tickTimer);
    if(document.hidden)return;
    updateClock();
    const delay=1000-(Date.now()%1000)+8;
    tickTimer=setTimeout(scheduleTick,delay);
  }

  function animateCalendarChange(){
    const box=$id("calendarDays");
    if(!box)return;
    box.classList.add("is-changing");
    requestAnimationFrame(()=>requestAnimationFrame(()=>box.classList.remove("is-changing")));
  }

  function renderCalendar(animate=true){
    const box=$id("calendarDays");
    if(!box)return;

    const y=calendarCursor.getFullYear();
    const m=calendarCursor.getMonth();
    const today=new Date();
    const first=new Date(y,m,1);
    const mondayIndex=(first.getDay()+6)%7;
    const start=new Date(y,m,1-mondayIndex);

    const title=$id("calendarMonthTitle");
    const label=$id("calendarMonthLabel");
    if(title)title.textContent=`${y}年${m+1}月`;
    if(label)label.textContent=`${m+1}月日历`;
    box.setAttribute("aria-label",`${y}年${m+1}月日历`);

    const frag=document.createDocumentFragment();

    for(let i=0;i<42;i++){
      const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
      const el=document.createElement("button");
      const holiday=holidayInfo(d);
      el.type="button";
      el.className="calendar-day";
      if(holiday){
        el.classList.add("has-holiday");
        if(holiday.major)el.classList.add("holiday-major");
        el.dataset.holiday=holiday.name;
        el.title=holiday.name;
      }
      const num=document.createElement("span");
      num.className="calendar-day-num";
      num.textContent=d.getDate();
      el.append(num);
      if(holiday){
        const tag=document.createElement("span");
        tag.className="calendar-holiday-tag";
        tag.textContent=holiday.short;
        el.append(tag);
      }
      el.dataset.date=dateKey(d);
      el.setAttribute("role","gridcell");
      el.setAttribute("aria-label",`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${weekdayLong[d.getDay()]}${holiday?" "+holiday.name:""}`);
      el.tabIndex=sameDate(d,calendarSelected)?0:-1;

      if(d.getMonth()!==m)el.classList.add("outside");
      if(sameDate(d,today)){
        el.classList.add("today");
        el.setAttribute("aria-current","date");
      }
      if(sameDate(d,calendarSelected)){
        el.classList.add("selected");
        el.setAttribute("aria-selected","true");
      }else{
        el.setAttribute("aria-selected","false");
      }

      el.onclick=()=>{
        calendarSelected=new Date(d);
        if(d.getMonth()!==m){
          calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
          userBrowsingMonth=!sameMonth(calendarCursor,new Date());
        }
        renderCalendar(true);
      };

      frag.append(el);
    }

    box.replaceChildren(frag);
    updateSelectedInfo();
    updateTodayButton();

    if(animate)animateCalendarChange();
  }

  function focusSelectedDay(){
    requestAnimationFrame(()=>{
      $id("calendarDays")?.querySelector('.calendar-day[tabindex="0"]')?.focus({preventScroll:true});
    });
  }

  function moveSelectedBy(days){
    const next=new Date(calendarSelected);
    next.setDate(next.getDate()+days);
    calendarSelected=next;
    calendarCursor=new Date(next.getFullYear(),next.getMonth(),1);
    userBrowsingMonth=!sameMonth(calendarCursor,new Date());
    renderCalendar(true);
    focusSelectedDay();
  }

  function changeMonth(delta){
    const day=calendarSelected.getDate();
    const targetMonth=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+delta,1);
    const maxDay=new Date(targetMonth.getFullYear(),targetMonth.getMonth()+1,0).getDate();
    calendarCursor=targetMonth;
    calendarSelected=new Date(targetMonth.getFullYear(),targetMonth.getMonth(),Math.min(day,maxDay));
    userBrowsingMonth=!sameMonth(calendarCursor,new Date());
    renderCalendar(true);
    focusSelectedDay();
  }

  function goToday(){
    const now=new Date();
    calendarSelected=new Date(now);
    calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);
    userBrowsingMonth=false;
    renderCalendar(true);
    updateClock();
    focusSelectedDay();
  }

  $id("calendarPrevBtn")?.addEventListener("click",()=>changeMonth(-1));
  $id("calendarNextBtn")?.addEventListener("click",()=>changeMonth(1));
  $id("calendarTodayBtn")?.addEventListener("click",goToday);

  $id("calendarDays")?.addEventListener("keydown",e=>{
    const key=e.key;
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown","Enter"," "].includes(key))return;

    if(key==="Enter"||key===" "){
      e.preventDefault();
      document.activeElement?.click();
      return;
    }

    e.preventDefault();

    if(key==="ArrowLeft")return moveSelectedBy(-1);
    if(key==="ArrowRight")return moveSelectedBy(1);
    if(key==="ArrowUp")return moveSelectedBy(-7);
    if(key==="ArrowDown")return moveSelectedBy(7);
    if(key==="PageUp")return changeMonth(-1);
    if(key==="PageDown")return changeMonth(1);

    const d=new Date(calendarSelected);
    const mondayIndex=(d.getDay()+6)%7;
    if(key==="Home")return moveSelectedBy(-mondayIndex);
    if(key==="End")return moveSelectedBy(6-mondayIndex);
  });

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      clearTimeout(tickTimer);
      tickTimer=0;
    }else{
      scheduleTick();
    }
  },{passive:true});

  window.addEventListener("pagehide",()=>clearTimeout(tickTimer),{passive:true});

  const now=new Date();
  calendarSelected=new Date(now);
  calendarCursor=new Date(now.getFullYear(),now.getMonth(),1);
  lastDateKey=dateKey(now);
  renderCalendar(false);
  scheduleTick();
})();
