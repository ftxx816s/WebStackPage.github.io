import {V17_CATEGORIES,V17_SITES} from "../_data/v17-seed.js";
import {json,requireAuth,sameOrigin,verifySession,normalizeUsername} from "../_shared/auth.js";

const BACKUP_KEEP=20,MAX_ICON_BYTES=1024*1024,AUTO_MAINTENANCE_MS=7*24*60*60*1000,KV_ORPHAN_DELETE_LIMIT=100;

function normalizeUrl(value){try{const u=new URL(String(value));if(!/^https?:$/.test(u.protocol))return "";u.hash="";u.hostname=u.hostname.toLowerCase();if(u.pathname!=="/")u.pathname=u.pathname.replace(/\/+$/,"");return u.href}catch{return ""}}
function domainOf(value){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,"")}catch{return ""}}
function rootDomain(host){const clean=String(host||"").toLowerCase().replace(/^www\./,"");const p=clean.split(".").filter(Boolean);if(p.length<=2)return clean;const s=p.slice(-2).join("."),special=new Set(["com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn","co.uk","org.uk","gov.uk","ac.uk","com.au","net.au","org.au","co.jp","ne.jp","or.jp","com.hk","com.tw","com.sg","com.br"]);return special.has(s)&&p.length>=3?p.slice(-3).join("."):p.slice(-2).join(".")}
let __schemaReadyPromiseV186=null;
async function ensureSchema(env){
  if(!env?.DB)throw new Error("Missing D1 binding: DB");
  if(!__schemaReadyPromiseV186){
    __schemaReadyPromiseV186=(async()=>{
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS categories_v17(name TEXT PRIMARY KEY,icon TEXT NOT NULL DEFAULT '•',sort_order INTEGER NOT NULL DEFAULT 0,is_builtin INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sites_v17(id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,normalized_url TEXT NOT NULL UNIQUE,domain TEXT NOT NULL,root_domain TEXT NOT NULL,full_title TEXT,category_name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,is_favorite INTEGER NOT NULL DEFAULT 0,is_deleted INTEGER NOT NULL DEFAULT 0,is_custom INTEGER NOT NULL DEFAULT 0,icon_url TEXT,icon_key TEXT,visit_count INTEGER NOT NULL DEFAULT 0,last_visited_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sites_v17_category_sort ON sites_v17(category_name,sort_order)`).run();
  await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sites_v17_root_domain ON sites_v17(root_domain)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings_v17(owner TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(owner,key))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS backups_v17(id INTEGER PRIMARY KEY AUTOINCREMENT,owner TEXT NOT NULL,revision INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();

    })().catch(err=>{__schemaReadyPromiseV186=null;throw err});
  }
  return __schemaReadyPromiseV186;
}
async function getSetting(env,owner,key){const r=await env.DB.prepare(`SELECT value FROM settings_v17 WHERE owner=? AND key=?`).bind(owner,key).first();return r?.value??null}
async function setSetting(env,owner,key,value){await env.DB.prepare(`INSERT INTO settings_v17(owner,key,value,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(owner,key,String(value)).run()}
async function getRevision(env,owner){return Number(await getSetting(env,owner,"revision"))||0}
async function seedIfNeeded(env){const row=await env.DB.prepare(`SELECT COUNT(*) AS c FROM sites_v17`).first();if(Number(row?.c)||0)return false;const catStatements=V17_CATEGORIES.map(c=>env.DB.prepare(`INSERT OR IGNORE INTO categories_v17(name,icon,sort_order,is_builtin) VALUES(?,?,?,1)`).bind(c.name,c.icon,c.sort));await env.DB.batch(catStatements);const siteStatements=V17_SITES.map(s=>{const n=normalizeUrl(s.url),d=domainOf(s.url);return env.DB.prepare(`INSERT OR IGNORE INTO sites_v17(id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,is_custom) VALUES(?,?,?,?,?,?,?,?,?,0)`).bind(s.id,s.name,s.url,n,d,rootDomain(d),s.fullTitle,s.category,s.sort)});for(let i=0;i<siteStatements.length;i+=70)await env.DB.batch(siteStatements.slice(i,i+70));return true}
function dataUrlParts(v){const m=String(v||"").match(/^data:(image\/(?:png|jpeg|jpg|webp|gif|x-icon|vnd\.microsoft\.icon));base64,(.+)$/i);if(!m)return null;try{const raw=atob(m[2]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return {type:m[1].replace("image/jpg","image/jpeg"),bytes}}catch{return null}}
async function migrateFromV16(env,owner){if(await getSetting(env,owner,"migrated_v16"))return "already";let source="seed-only";try{const old=await env.DB.prepare(`SELECT data FROM nav_state WHERE owner=? LIMIT 1`).bind(owner).first();if(old?.data){const d=JSON.parse(old.data);source="nav_state";
    if(Array.isArray(d.customCategories)){for(let i=0;i<d.customCategories.length;i++){const c=d.customCategories[i];if(c?.name)await env.DB.prepare(`INSERT OR IGNORE INTO categories_v17(name,icon,sort_order,is_builtin) VALUES(?,?,?,0)`).bind(String(c.name),String(c.icon||"•"),100+i).run()}}
    if(Array.isArray(d.custom)){for(const s of d.custom){const n=normalizeUrl(s?.url);if(!n)continue;const domain=domainOf(n),cat=String(d.categoryOverrides?.[s.id]||s.category||V17_CATEGORIES[0].name);try{await env.DB.prepare(`INSERT OR IGNORE INTO sites_v17(id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,is_custom,icon_url) VALUES(?,?,?,?,?,?,?,?,?,1,?)`).bind(String(s.id),String(s.name||domain),n,n,domain,rootDomain(domain),String(s.fullTitle||s.name||domain),cat,999,String(s.iconUrl||"")).run()}catch{}}}
    if(d.siteEdits&&typeof d.siteEdits==="object"){for(const [id,e] of Object.entries(d.siteEdits)){const n=normalizeUrl(e?.url);if(!n)continue;const domain=domainOf(n);await env.DB.prepare(`UPDATE sites_v17 SET name=?,url=?,normalized_url=?,domain=?,root_domain=?,full_title=?,icon_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(String(e?.name||domain),n,n,domain,rootDomain(domain),String(e?.name||domain),String(e?.iconUrl||""),id).run()}}
    if(d.categoryOverrides&&typeof d.categoryOverrides==="object"){for(const [id,cat] of Object.entries(d.categoryOverrides))await env.DB.prepare(`UPDATE sites_v17 SET category_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(String(cat),id).run()}
    if(Array.isArray(d.favorites)){for(const id of d.favorites)await env.DB.prepare(`UPDATE sites_v17 SET is_favorite=1 WHERE id=?`).bind(String(id)).run()}
    if(Array.isArray(d.hiddenSites)){for(const id of d.hiddenSites)await env.DB.prepare(`UPDATE sites_v17 SET is_deleted=1 WHERE id=?`).bind(String(id)).run()}
    if(Array.isArray(d.categoryOrder)){for(let i=0;i<d.categoryOrder.length;i++)await env.DB.prepare(`UPDATE categories_v17 SET sort_order=? WHERE name=?`).bind(i,String(d.categoryOrder[i])).run()}
    if(d.categoryIconOverrides&&typeof d.categoryIconOverrides==="object"){for(const [name,icon] of Object.entries(d.categoryIconOverrides))await env.DB.prepare(`UPDATE categories_v17 SET icon=? WHERE name=?`).bind(String(icon||"•"),String(name)).run()}
    if(d.siteOrder&&typeof d.siteOrder==="object"){for(const [cat,ids] of Object.entries(d.siteOrder)){if(!Array.isArray(ids))continue;for(let i=0;i<ids.length;i++)await env.DB.prepare(`UPDATE sites_v17 SET sort_order=?,category_name=? WHERE id=?`).bind(i,String(cat),String(ids[i])).run()}}
    const ui={recents:Array.isArray(d.recents)?d.recents:[],usageStats:d.usageStats&&typeof d.usageStats==="object"?d.usageStats:{},density:d.density||"comfortable",theme:d.theme||"dark"};await setSetting(env,owner,"ui",JSON.stringify(ui));
    if(env.KV&&d.iconOverrides&&typeof d.iconOverrides==="object"){for(const [id,val] of Object.entries(d.iconOverrides)){const p=dataUrlParts(val);if(!p||p.bytes.byteLength>MAX_ICON_BYTES)continue;const key=`custom:${owner}:${id}:${crypto.randomUUID()}`;await env.KV.put(key,p.bytes,{metadata:{contentType:p.type,kind:"custom"}});await env.DB.prepare(`UPDATE sites_v17 SET icon_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,id).run()}}
  }}catch{}
  await setSetting(env,owner,"migrated_v16","1");return source
}
async function buildBootstrap(env,owner,migrationSource,{publicView=false}={}){
  const cats=(await env.DB.prepare(`SELECT * FROM categories_v17 ORDER BY sort_order,name`).all()).results||[];
  const sql=publicView
    ? `SELECT id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,0 AS is_favorite,0 AS is_deleted,is_custom,icon_url,CASE WHEN icon_key IS NOT NULL THEN 1 ELSE 0 END AS has_custom_icon,visit_count,last_visited_at,updated_at,created_at FROM sites_v17 WHERE is_deleted=0 ORDER BY category_name,sort_order,name`
    : `SELECT id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,is_favorite,is_deleted,is_custom,icon_url,CASE WHEN icon_key IS NOT NULL THEN 1 ELSE 0 END AS has_custom_icon,visit_count,last_visited_at,updated_at,created_at FROM sites_v17 ORDER BY category_name,sort_order,name`;
  const sites=(await env.DB.prepare(sql).all()).results||[];
  let settings={};
  try{
    const ui=JSON.parse(await getSetting(env,owner,"ui")||"{}")||{};
    settings=publicView?{categoryTitles:(ui.categoryTitles&&typeof ui.categoryTitles==="object"&&!Array.isArray(ui.categoryTitles))?ui.categoryTitles:{}}:ui;
  }catch{settings={}}
  return {ok:true,revision:await getRevision(env,owner),migrationSource,categories:cats,sites,settings,iconStore:"kv",kv:!!env.KV,access:publicView?"guest":"admin",authenticated:!publicView};
}
async function backupSnapshot(env,owner,revision){const snap=await buildBootstrap(env,owner,"backup");await env.DB.prepare(`INSERT INTO backups_v17(owner,revision,snapshot,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)`).bind(owner,revision,JSON.stringify(snap)).run();await env.DB.prepare(`DELETE FROM backups_v17 WHERE owner=? AND id NOT IN (SELECT id FROM backups_v17 WHERE owner=? ORDER BY id DESC LIMIT ?)`).bind(owner,owner,BACKUP_KEEP).run()}

async function listBackups(env,owner){
  const rows=(await env.DB.prepare(`SELECT id,revision,snapshot,created_at FROM backups_v17 WHERE owner=? ORDER BY id DESC LIMIT ?`).bind(owner,BACKUP_KEEP).all()).results||[];
  const backups=rows.map(row=>{
    let siteCount=0,categoryCount=0;
    try{
      const snap=JSON.parse(row.snapshot||"{}");
      siteCount=Array.isArray(snap.sites)?snap.sites.length:0;
      categoryCount=Array.isArray(snap.categories)?snap.categories.length:0;
    }catch{}
    return {id:Number(row.id),revision:Number(row.revision)||0,createdAt:row.created_at,siteCount,categoryCount};
  });
  return json({ok:true,backups});
}
function backupToSyncBody(snapshot,currentRevision){
  const cats=(Array.isArray(snapshot?.categories)?snapshot.categories:[]).map(c=>({
    name:String(c?.name||""),
    icon:String(c?.icon||"•"),
    sortOrder:Number(c?.sort_order??c?.sortOrder)||0,
    isBuiltin:Number(c?.is_builtin??c?.isBuiltin)!==0
  }));
  const sites=(Array.isArray(snapshot?.sites)?snapshot.sites:[]).map(s=>({
    id:String(s?.id||""),
    name:String(s?.name||""),
    url:String(s?.url||""),
    fullTitle:String(s?.full_title??s?.fullTitle??s?.name??""),
    category:String(s?.category_name??s?.category??""),
    sortOrder:Number(s?.sort_order??s?.sortOrder)||0,
    isFavorite:Number(s?.is_favorite??s?.isFavorite)!==0,
    isDeleted:Number(s?.is_deleted??s?.isDeleted)!==0,
    isCustom:Number(s?.is_custom??s?.isCustom)!==0,
    iconUrl:String(s?.icon_url??s?.iconUrl??"")
  }));
  return {baseRevision:currentRevision,force:true,categories:cats,sites,settings:(snapshot?.settings&&typeof snapshot.settings==="object")?snapshot.settings:{}};
}
async function restoreBackup(env,owner,id){
  const row=await env.DB.prepare(`SELECT snapshot FROM backups_v17 WHERE owner=? AND id=? LIMIT 1`).bind(owner,id).first();
  if(!row?.snapshot)return json({ok:false,error:"Backup not found."},404);
  let snap=null;try{snap=JSON.parse(row.snapshot)}catch{return json({ok:false,error:"Backup is corrupted."},500)}
  const current=await getRevision(env,owner);
  return await syncSnapshot(env,owner,backupToSyncBody(snap,current));
}
function privateHost(host){
  const h=String(host||"").toLowerCase();
  if(!h||h==="localhost"||h.endsWith(".localhost")||h.endsWith(".local")||h.endsWith(".internal")||h.endsWith(".lan"))return true;
  if(h==="::1"||h==="0:0:0:0:0:0:0:1")return true;if(h.includes(":")&&(/^(?:fc|fd)/i.test(h)||/^fe[89ab]/i.test(h)))return true;
  const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(m){
    const a=Number(m[1]),b=Number(m[2]);
    if(a===10||a===127||a===0||a>=224)return true;
    if(a===169&&b===254)return true;
    if(a===172&&b>=16&&b<=31)return true;
    if(a===192&&b===168)return true;
  }
  return false;
}
async function checkSiteHealth(site){
  let u=null;try{u=new URL(site.url)}catch{return {id:site.id,kind:"bad",label:"网址无效",status:0}}
  if(!/^https?:$/.test(u.protocol)||privateHost(u.hostname))return {id:site.id,kind:"bad",label:"已阻止检测",status:0};
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),4500);
  try{
    const res=await fetch(u.href,{method:"HEAD",redirect:"manual",signal:ctl.signal,headers:{"User-Agent":"Mozilla/5.0"}});
    const status=Number(res.status)||0;
    if(status>=200&&status<300)return {id:site.id,kind:"ok",label:`正常 ${status}`,status};
    if(status>=300&&status<400)return {id:site.id,kind:"warn",label:`重定向 ${status}`,status,location:res.headers.get("location")||""};
    if(status===401||status===403||status===405)return {id:site.id,kind:"warn",label:`可访问 ${status}`,status};
    return {id:site.id,kind:"bad",label:`异常 ${status||"?"}`,status};
  }catch{
    return {id:site.id,kind:"bad",label:"连接失败",status:0};
  }finally{clearTimeout(timer)}
}
async function refreshIcons(env,owner,ids){
  if(!env.KV)return json({ok:false,error:"Missing KV binding: KV"},500);
  const clean=[...new Set((Array.isArray(ids)?ids:[]).map(String))].slice(0,60);
  let refreshed=0,skipped=0;
  for(const id of clean){
    const site=await env.DB.prepare(`SELECT * FROM sites_v17 WHERE id=? LIMIT 1`).bind(id).first();
    if(!site){skipped++;continue}
    if(site.icon_key&&String(site.icon_key).startsWith("custom:")){skipped++;continue}
    const hostKey=faviconCacheKeyV186(site),legacyKey=legacyFaviconKeyV186(site);
    if(hostKey)await env.KV.delete(hostKey);
    if(legacyKey)await env.KV.delete(legacyKey);
    await serveIcon(env,site);
    await env.DB.prepare(`UPDATE sites_v17 SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();
    refreshed++;
  }
  if(refreshed){
    const rev=await getRevision(env,owner)+1;
    await setSetting(env,owner,"revision",String(rev));
    return json({ok:true,refreshed,skipped,revision:rev});
  }
  return json({ok:true,refreshed,skipped,revision:await getRevision(env,owner)});
}
async function healthBatch(env,ids){
  const clean=[...new Set((Array.isArray(ids)?ids:[]).map(String))].slice(0,12);
  if(!clean.length)return json({ok:true,results:[]});
  const marks=clean.map(()=>"?").join(",");
  const rows=(await env.DB.prepare(`SELECT id,url FROM sites_v17 WHERE id IN (${marks})`).bind(...clean).all()).results||[];
  const results=await Promise.all(rows.map(checkSiteHealth));
  return json({ok:true,results});
}
function validateSnapshot(body){const cats=Array.isArray(body?.categories)?body.categories:[],sites=Array.isArray(body?.sites)?body.sites:[];const seen=new Map(),dups=[];for(const s of sites){const n=normalizeUrl(s?.url);if(!n)continue;if(seen.has(n))dups.push({url:n,a:seen.get(n),b:s.id});else seen.set(n,s.id)}return {cats,sites,dups}}
function incomingCategory(c){const name=String(c?.name||"").trim();if(!name)return null;return {name,icon:String(c?.icon||"•"),sort_order:Number(c?.sortOrder)||0,is_builtin:c?.isBuiltin?1:0}}
function incomingSite(s){const id=String(s?.id||"").trim(),n=normalizeUrl(s?.url);if(!id||!n)return null;const d=domainOf(n);return {id,name:String(s?.name||d),url:n,normalized_url:n,domain:d,root_domain:rootDomain(d),full_title:String(s?.fullTitle||s?.name||d),category_name:String(s?.category||V17_CATEGORIES[0].name),sort_order:Number(s?.sortOrder)||0,is_favorite:s?.isFavorite?1:0,is_deleted:s?.isDeleted?1:0,is_custom:s?.isCustom?1:0,icon_url:String(s?.iconUrl||"")}}
function sameCategory(a,b){return !!a&&String(a.icon||"•")===b.icon&&Number(a.sort_order||0)===b.sort_order&&Number(a.is_builtin||0)===b.is_builtin}
function sameSite(a,b){return !!a&&String(a.name||"")===b.name&&String(a.url||"")===b.url&&String(a.normalized_url||"")===b.normalized_url&&String(a.domain||"")===b.domain&&String(a.root_domain||"")===b.root_domain&&String(a.full_title||"")===b.full_title&&String(a.category_name||"")===b.category_name&&Number(a.sort_order||0)===b.sort_order&&Number(a.is_favorite||0)===b.is_favorite&&Number(a.is_deleted||0)===b.is_deleted&&Number(a.is_custom||0)===b.is_custom&&String(a.icon_url||"")===b.icon_url}
async function runBatches(env,statements,size=40){for(let i=0;i<statements.length;i+=size)await env.DB.batch(statements.slice(i,i+size))}
async function planSnapshotDiff(env,owner,cats,sites,ui){
  const dbCats=(await env.DB.prepare(`SELECT name,icon,sort_order,is_builtin FROM categories_v17`).all()).results||[];
  const dbSites=(await env.DB.prepare(`SELECT id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,is_favorite,is_deleted,is_custom,icon_url,icon_key FROM sites_v17`).all()).results||[];
  const catMap=new Map(dbCats.map(r=>[String(r.name),r])),siteMap=new Map(dbSites.map(r=>[String(r.id),r]));
  const inCats=cats.map(incomingCategory).filter(Boolean),inSites=sites.map(incomingSite).filter(Boolean);
  const inCatNames=new Set(inCats.map(r=>r.name)),inSiteIds=new Set(inSites.map(r=>r.id));
  const categoryUpserts=inCats.filter(r=>!sameCategory(catMap.get(r.name),r));
  const categoryDeletes=dbCats.filter(r=>Number(r.is_builtin)===0&&!inCatNames.has(String(r.name)));
  const siteUpserts=inSites.filter(r=>!sameSite(siteMap.get(r.id),r));
  const siteDeletes=dbSites.filter(r=>Number(r.is_custom)!==0&&!inSiteIds.has(String(r.id)));
  const uiJson=JSON.stringify(ui||{}),oldUi=await getSetting(env,owner,"ui");
  return {categoryUpserts,categoryDeletes,siteUpserts,siteDeletes,uiJson,settingsChanged:String(oldUi??"")!==uiJson,structuralChanged:categoryUpserts.length>0||categoryDeletes.length>0||siteUpserts.length>0||siteDeletes.length>0};
}
async function syncSnapshot(env,owner,body){
  const {cats,sites,dups}=validateSnapshot(body);if(dups.length)return json({ok:false,error:"Duplicate URL detected.",duplicates:dups},409);
  const current=await getRevision(env,owner),base=Math.max(0,Number(body?.baseRevision)||0),force=body?.force===true;if(!force&&base!==current)return json({ok:false,error:"Revision conflict.",revision:current},409);
  const ui=body?.settings&&typeof body.settings==="object"?body.settings:{};
  const plan=await planSnapshotDiff(env,owner,cats,sites,ui);
  if(!plan.structuralChanged&&!plan.settingsChanged)return json({ok:true,revision:current,unchanged:true,writes:0});
  // Only structural changes need a recovery snapshot. Recents/theme/usage-only changes no longer create full snapshots.
  if(plan.structuralChanged)await backupSnapshot(env,owner,current);
  for(const r of plan.siteDeletes){if(env.KV&&r.icon_key&&String(r.icon_key).startsWith("custom:"))await env.KV.delete(r.icon_key)}
  const deletes=[];
  for(const r of plan.siteDeletes)deletes.push(env.DB.prepare(`DELETE FROM sites_v17 WHERE id=?`).bind(r.id));
  for(const r of plan.categoryDeletes)deletes.push(env.DB.prepare(`DELETE FROM categories_v17 WHERE name=?`).bind(r.name));
  await runBatches(env,deletes);
  const catStatements=plan.categoryUpserts.map(c=>env.DB.prepare(`INSERT INTO categories_v17(name,icon,sort_order,is_builtin,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET icon=excluded.icon,sort_order=excluded.sort_order,is_builtin=excluded.is_builtin,updated_at=CURRENT_TIMESTAMP`).bind(c.name,c.icon,c.sort_order,c.is_builtin));
  await runBatches(env,catStatements);
  const siteStatements=plan.siteUpserts.map(s=>env.DB.prepare(`INSERT INTO sites_v17(id,name,url,normalized_url,domain,root_domain,full_title,category_name,sort_order,is_favorite,is_deleted,is_custom,icon_url,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url,normalized_url=excluded.normalized_url,domain=excluded.domain,root_domain=excluded.root_domain,full_title=excluded.full_title,category_name=excluded.category_name,sort_order=excluded.sort_order,is_favorite=excluded.is_favorite,is_deleted=excluded.is_deleted,is_custom=excluded.is_custom,icon_url=excluded.icon_url,updated_at=CURRENT_TIMESTAMP`).bind(s.id,s.name,s.url,s.normalized_url,s.domain,s.root_domain,s.full_title,s.category_name,s.sort_order,s.is_favorite,s.is_deleted,s.is_custom,s.icon_url));
  await runBatches(env,siteStatements);
  if(plan.settingsChanged)await setSetting(env,owner,"ui",plan.uiJson);
  const revision=current+1;await setSetting(env,owner,"revision",String(revision));
  const writes=plan.categoryUpserts.length+plan.categoryDeletes.length+plan.siteUpserts.length+plan.siteDeletes.length+(plan.settingsChanged?1:0)+1+(plan.structuralChanged?1:0);
  return json({ok:true,revision,writes,changed:{sites:plan.siteUpserts.length,siteDeletes:plan.siteDeletes.length,categories:plan.categoryUpserts.length,categoryDeletes:plan.categoryDeletes.length,settings:plan.settingsChanged,backup:plan.structuralChanged}})
}
async function listKvPrefix(env,prefix,maxKeys=5000){
  if(!env.KV)return {keys:[],complete:true};let cursor=undefined,keys=[],complete=false;
  do{const page=await env.KV.list({prefix,limit:1000,...(cursor?{cursor}:{})});keys.push(...(page.keys||[]));complete=!!page.list_complete;cursor=page.cursor||undefined;if(keys.length>=maxKeys)break}while(!complete&&cursor);
  return {keys:keys.slice(0,maxKeys),complete:complete||keys.length<maxKeys};
}
async function maintenanceReport(env,owner,{clean=false,auto=false}={}){
  const stats=await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM sites_v17) AS sites,(SELECT COUNT(*) FROM sites_v17 WHERE is_custom<>0) AS custom_sites,(SELECT COUNT(*) FROM sites_v17 WHERE is_deleted<>0) AS hidden_sites,(SELECT COUNT(*) FROM categories_v17) AS categories,(SELECT COUNT(*) FROM backups_v17 WHERE owner=?) AS backups`).bind(owner).first()||{};
  const duplicates=(await env.DB.prepare(`SELECT normalized_url,COUNT(*) AS c FROM sites_v17 GROUP BY normalized_url HAVING COUNT(*)>1 ORDER BY c DESC LIMIT 20`).all()).results||[];
  const refs=(await env.DB.prepare(`SELECT id,icon_key FROM sites_v17 WHERE icon_key IS NOT NULL AND icon_key LIKE 'custom:%'`).all()).results||[];
  const validCustomKeys=new Set(refs.map(r=>String(r.icon_key||"")).filter(Boolean));
  const listed=await listKvPrefix(env,`custom:${owner}:`),orphanKeys=listed.keys.map(k=>String(k.name||"")).filter(k=>k&&!validCustomKeys.has(k));
  const backupCount=Number(stats.backups)||0,extraBackups=Math.max(0,backupCount-BACKUP_KEEP);
  let deletedBackups=0,deletedOrphanIcons=0;
  if(clean){
    if(extraBackups){const res=await env.DB.prepare(`DELETE FROM backups_v17 WHERE owner=? AND id NOT IN (SELECT id FROM backups_v17 WHERE owner=? ORDER BY id DESC LIMIT ?)`).bind(owner,owner,BACKUP_KEEP).run();deletedBackups=Number(res?.meta?.changes)||extraBackups}
    if(env.KV&&orphanKeys.length){for(const key of orphanKeys.slice(0,KV_ORPHAN_DELETE_LIMIT)){await env.KV.delete(key);deletedOrphanIcons++}}
    await setSetting(env,owner,"maintenance_last",new Date().toISOString());
  }
  return {ok:true,auto,cleaned:clean,policy:{backupKeep:BACKUP_KEEP,customIconDeleteLimit:KV_ORPHAN_DELETE_LIMIT,faviconTtlDays:30,autoMaintenanceDays:7},d1:{sites:Number(stats.sites)||0,customSites:Number(stats.custom_sites)||0,hiddenSites:Number(stats.hidden_sites)||0,categories:Number(stats.categories)||0,backups:backupCount,extraBackups,exactDuplicateUrls:duplicates.length,duplicates:duplicates.map(r=>({url:r.normalized_url,count:Number(r.c)||0}))},kv:{enabled:!!env.KV,customKeys:listed.keys.length,referencedCustomKeys:validCustomKeys.size,orphanCustomKeys:orphanKeys.length,listComplete:listed.complete,deletedOrphanIcons},deletedBackups,lastMaintenance:(clean?new Date().toISOString():await getSetting(env,owner,"maintenance_last"))||""};
}
async function maybeAutoMaintenance(context,env,owner){
  try{const last=Date.parse(await getSetting(env,owner,"maintenance_last")||"")||0;if(Date.now()-last<AUTO_MAINTENANCE_MS)return;const job=maintenanceReport(env,owner,{clean:true,auto:true}).catch(()=>{});if(typeof context?.waitUntil==="function")context.waitUntil(job);else await job}catch{}
}
function kvIconResponse(value,metadata={}){const type=metadata?.contentType||"image/png";return new Response(value,{headers:{"Content-Type":type,"Cache-Control":"public, max-age=86400, stale-while-revalidate=604800","X-Content-Type-Options":"nosniff"}})}
function fallbackSvg(name){const ch=String(name||"?").trim().charAt(0).toUpperCase()||"?";return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7187ff"/><stop offset="1" stop-color="#a45cf6"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/><text x="64" y="80" text-anchor="middle" font-family="Arial,sans-serif" font-size="64" font-weight="700" fill="white">${ch.replace(/[<>&]/g,"")}</text></svg>`}
async function fetchCandidate(url){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),3500);try{const r=await fetch(url,{redirect:"follow",signal:ctl.signal,headers:{"User-Agent":"Mozilla/5.0"}});if(!r.ok)return null;const ct=(r.headers.get("content-type")||"").split(";")[0].trim();if(!ct.startsWith("image/"))return null;const buf=await r.arrayBuffer();if(buf.byteLength<350||buf.byteLength>MAX_ICON_BYTES)return null;return {buf,type:ct}}catch{return null}finally{clearTimeout(t)}}
function faviconHost(site){return domainOf(site?.url)||String(site?.domain||"").toLowerCase().replace(/^www\./,"")}
function faviconCacheKeyV186(site){const host=faviconHost(site);return host?`favicon:v2:${host}`:""}
function legacyFaviconKeyV186(site){const root=site?.root_domain||rootDomain(site?.domain);return root?`favicon:${root}`:""}
async function getKvIcon(env,key){if(!env.KV)return null;const got=await env.KV.getWithMetadata(key,{type:"arrayBuffer",cacheTtl:86400});if(!got?.value)return null;return {value:got.value,metadata:got.metadata||{}}}
async function serveIcon(env,site){
  if(!env.KV)return new Response(fallbackSvg(site.name),{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"no-store"}});
  if(site.icon_key){
    const custom=await getKvIcon(env,site.icon_key);
    if(custom)return kvIconResponse(custom.value,custom.metadata);
  }

  const host=faviconHost(site),key=faviconCacheKeyV186(site);
  if(key){
    const cached=await getKvIcon(env,key);
    if(cached)return kvIconResponse(cached.value,cached.metadata);
  }

  /* Backward compatibility only when hostname itself is the root domain.
     Subdomains such as mail.google.com must not inherit google.com favicon cache. */
  const root=site.root_domain||rootDomain(site.domain);
  if(host&&root&&host===root){
    const legacyKey=legacyFaviconKeyV186(site),legacy=legacyKey?await getKvIcon(env,legacyKey):null;
    if(legacy){
      if(key)await env.KV.put(key,legacy.value,{expirationTtl:60*60*24*30,metadata:{...(legacy.metadata||{}),domain:host,migrated:"v18.6"}});
      return kvIconResponse(legacy.value,legacy.metadata);
    }
  }

  const sources=[];
  if(site.icon_url&&/^https?:\/\//i.test(site.icon_url)){
    try{const u=new URL(site.icon_url);if(!privateHost(u.hostname))sources.push(u.href)}catch{}
  }
  sources.push(
    `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(site.url)}`,
    `https://icon.horse/icon/${encodeURIComponent(host||site.domain)}`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host||site.domain)}.ico`
  );

  for(const u of sources){
    const got=await fetchCandidate(u);if(!got)continue;
    if(key)await env.KV.put(key,got.buf,{expirationTtl:60*60*24*30,metadata:{contentType:got.type,kind:"favicon",source:u,domain:host}});
    return kvIconResponse(got.buf,{contentType:got.type});
  }
  return new Response(fallbackSvg(site.name),{headers:{"Content-Type":"image/svg+xml; charset=utf-8","Cache-Control":"public, max-age=3600"}});
}

export async function onRequest(context){const {request,env}=context;try{const url=new URL(request.url),mode=String(url.searchParams.get("mode")||"");
  if(mode==="healthz"&&request.method==="GET"){
    if(!env?.DB)return json({ok:false,db:false,kv:!!env?.KV,error:"Missing D1 binding: DB"},500);
    await ensureSchema(env);
    let revision=0;try{revision=await getRevision(env,normalizeUsername(env.NAV_USERNAME||"admin"))}catch{}
    return json({ok:true,db:true,kv:!!env.KV,revision,apiVersion:"18.19"});
  }
  await ensureSchema(env);const owner=normalizeUsername(env.NAV_USERNAME||"admin");
  // Public read endpoints: no password required.
  if(mode==="bootstrap"&&request.method==="GET"){
    const seeded=await seedIfNeeded(env);let session=null;try{session=await verifySession(request,env)}catch{}
    if(session){const source=await migrateFromV16(env,owner);if(seeded&&!await getSetting(env,owner,"revision"))await setSetting(env,owner,"revision","1");const payload=await buildBootstrap(env,owner,source,{publicView:false});await maybeAutoMaintenance(context,env,owner);return json(payload)}
    if(seeded&&!await getSetting(env,owner,"revision"))await setSetting(env,owner,"revision","1");return json(await buildBootstrap(env,owner,"public",{publicView:true}));
  }
  if(mode==="icon"&&request.method==="GET"){
    const id=String(url.searchParams.get("site")||"");const site=await env.DB.prepare(`SELECT * FROM sites_v17 WHERE id=? LIMIT 1`).bind(id).first();if(!site)return json({ok:false,error:"Site not found."},404);return await serveIcon(env,site)
  }

  // Everything below mutates cloud state and therefore requires admin auth.
  const auth=await requireAuth(request,env);if(auth.error)return auth.error;
  if(mode==="sync"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);return await syncSnapshot(env,auth.owner,await request.json())}
  if(mode==="backups"&&request.method==="GET"){return await listBackups(env,auth.owner)}
  if(mode==="maintenance"&&request.method==="GET"){return json(await maintenanceReport(env,auth.owner,{clean:false}))}
  if(mode==="maintenance"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);return json(await maintenanceReport(env,auth.owner,{clean:true}))}
  if(mode==="backup-now"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);const rev=await getRevision(env,auth.owner);await backupSnapshot(env,auth.owner,rev);return json({ok:true,revision:rev})}
  if(mode==="restore-backup"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);const body=await request.json();return await restoreBackup(env,auth.owner,Number(body?.id)||0)}
  if(mode==="refresh-icons"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);const body=await request.json();return await refreshIcons(env,auth.owner,body?.ids)}
  if(mode==="health"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);const body=await request.json();return await healthBatch(env,body?.ids)}
  if(mode==="upload-icon"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);if(!env.KV)return json({ok:false,error:"Missing KV binding: KV"},500);const id=String(url.searchParams.get("site")||""),site=await env.DB.prepare(`SELECT id,icon_key FROM sites_v17 WHERE id=? LIMIT 1`).bind(id).first();if(!site)return json({ok:false,error:"Site not found."},404);const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase(),allowed=new Set(["image/png","image/jpeg","image/webp","image/gif","image/x-icon","image/vnd.microsoft.icon"]);if(!allowed.has(type))return json({ok:false,error:"Only PNG/JPG/WebP/GIF/ICO are allowed."},415);const buf=await request.arrayBuffer();if(!buf.byteLength||buf.byteLength>MAX_ICON_BYTES)return json({ok:false,error:"Icon must be 1MB or smaller."},413);const key=`custom:${auth.owner}:${id}:${crypto.randomUUID()}`;await env.KV.put(key,buf,{metadata:{contentType:type,kind:"custom"}});if(site.icon_key&&String(site.icon_key).startsWith("custom:"))await env.KV.delete(site.icon_key);await env.DB.prepare(`UPDATE sites_v17 SET icon_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(key,id).run();const rev=await getRevision(env,auth.owner)+1;await setSetting(env,auth.owner,"revision",String(rev));return json({ok:true,revision:rev})}
  if(mode==="reset-icon"&&request.method==="POST"){if(!sameOrigin(request))return json({ok:false,error:"Invalid origin."},403);const id=String(url.searchParams.get("site")||""),site=await env.DB.prepare(`SELECT icon_key FROM sites_v17 WHERE id=? LIMIT 1`).bind(id).first();if(!site)return json({ok:false,error:"Site not found."},404);if(env.KV&&site.icon_key&&String(site.icon_key).startsWith("custom:"))await env.KV.delete(site.icon_key);await env.DB.prepare(`UPDATE sites_v17 SET icon_key=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run();const rev=await getRevision(env,auth.owner)+1;await setSetting(env,auth.owner,"revision",String(rev));return json({ok:true,revision:rev})}
  return json({ok:false,error:"Not found."},404)
}catch(e){return json({ok:false,error:"V18.19 API error: "+String(e?.message||e)},500)}}
