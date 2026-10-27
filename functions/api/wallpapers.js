// V19.58 — cloud wallpaper catalogue, stored losslessly in dedicated D1 binding WALLPAPER_DB.
// Authentication reuses the site's existing signed HttpOnly fxnav_session cookie.
import {json,requireAuth,sameOrigin} from '../_shared/auth.js';
const MAX_FILE_BYTES=1_900_000; // under D1 2,000,000-byte BLOB/row limit
const MAX_USER_FILES=9; // 1 protected packaged default + 9 uploads = 10
const MIME=['image/png','image/jpeg','image/webp'];
let initialized=null;
function dbOf(env){return env.WALLPAPER_DB}
function unavailable(){return json({ok:false,error:'缺少 WALLPAPER_DB 绑定，请先配置独立 D1 数据库。'},503)}
function headers(request){return {"Vary":"Cookie","X-Content-Type-Options":"nosniff"}}
async function init(env){
  const db=dbOf(env);
  if(!db)throw new Error('WALLPAPER_DB not configured');
  if(!initialized){initialized=(async()=>{
    await db.prepare(`CREATE TABLE IF NOT EXISTS wallpaper_items (
      id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes>0 AND size_bytes<=1900000),
      data BLOB NOT NULL,sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await db.prepare(`CREATE TABLE IF NOT EXISTS wallpaper_state (
      name TEXT PRIMARY KEY,value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();
  })().catch(e=>{initialized=null;throw e})}
  return initialized;
}
async function current(db){
  const p=await db.prepare("SELECT value,updated_at FROM wallpaper_state WHERE name='active' LIMIT 1").first();
  let id=String(p?.value||'default');
  if(id!=='default'){
    const hit=await db.prepare('SELECT id FROM wallpaper_items WHERE id=? LIMIT 1').bind(id).first();
    if(!hit)id='default';
  }
  return {id,version:String(p?.updated_at||'1')};
}
async function admin(request,env){
  if(!sameOrigin(request))return {error:json({ok:false,error:'请求来源不匹配。'},403)};
  return requireAuth(request,env);
}
function shaHex(digest){return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')}
function validSignature(bytes,mime){
  if(mime==='image/png')return bytes.length>24&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
  if(mime==='image/jpeg')return bytes.length>12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(mime==='image/webp')return bytes.length>20&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  return false;
}
// Prevent oversized streaming uploads from allocating unlimited memory.
async function readLimited(request,max){
  const contentLen=Number(request.headers.get('Content-Length')||0);
  if(contentLen>max)throw Object.assign(new Error('图片超过 1.9 MB 上限，不会压缩原图。'),{status:413});
  if(!request.body)throw Object.assign(new Error('图片内容为空。'),{status:400});
  const reader=request.body.getReader(),parts=[];let total=0;
  try{
    while(true){const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;if(total>max)throw Object.assign(new Error('图片超过 1.9 MB 上限，不会压缩原图。'),{status:413});
      parts.push(value);
    }
  }finally{try{await reader.cancel()}catch{}}
  const result=new Uint8Array(total);let offset=0;for(const p of parts){result.set(p,offset);offset+=p.byteLength}
  return result;
}
async function setActive(db,id){
  if(id!=='default'){
    const exists=await db.prepare('SELECT id FROM wallpaper_items WHERE id=? LIMIT 1').bind(id).first();
    if(!exists)return json({ok:false,error:'壁纸不存在或已删除。'},404);
  }
  // Counter increases monotonically; timestamps only have second-level precision and can cache stale images.
  const rev=String(Date.now());
  await db.prepare(`INSERT INTO wallpaper_state(name,value,updated_at) VALUES('active',?,?)
     ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(id,rev).run();
  return json({ok:true,active:id,version:rev});
}
export async function onRequestGet({request,env}){
  if(!dbOf(env))return unavailable();
  try{
    await init(env);const mode=new URL(request.url).searchParams.get('mode')||'active',db=dbOf(env);
    if(mode==='active'){
      const state=await current(db);return json({ok:true,active:state.id,version:state.version,max:10},200,headers(request));
    }
    if(mode!=='list')return json({ok:false,error:'Unknown mode'},400);
    const auth=await requireAuth(request,env);if(auth.error)return auth.error;
    const [result,state]=await Promise.all([
      db.prepare('SELECT id,name,mime,size_bytes,sha256,created_at FROM wallpaper_items ORDER BY created_at DESC,id DESC').all(),
      current(db)
    ]);
    const items=(result.results||[]).map(row=>({id:String(row.id),name:String(row.name),type:String(row.mime),size:Number(row.size_bytes),version:String(row.sha256).slice(0,16),createdAt:row.created_at}));
    return json({ok:true,max:10,active:state.id,version:state.version,items},200,headers(request));
  }catch(err){return json({ok:false,error:'读取壁纸库失败：'+String(err.message||err)},500)}
}
export async function onRequestPost({request,env}){
  if(!dbOf(env))return unavailable();
  const auth=await admin(request,env);if(auth.error)return auth.error;
  const url=new URL(request.url),action=url.searchParams.get('action')||'';
  try{
    await init(env);const db=dbOf(env);
    if(action==='select'){
      const body=await request.json();const id=String(body?.id||'').trim();
      if(id!=='default'&&!/^[0-9a-f-]{36}$/.test(id))return json({ok:false,error:'非法壁纸编号。'},400);
      return await setActive(db,id);
    }
    if(action!=='upload')return json({ok:false,error:'Unknown action'},400);
    const mime=(request.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
    if(!MIME.includes(mime))return json({ok:false,error:'只允许 PNG、JPEG、WebP。'},415);
    const bytes=await readLimited(request,MAX_FILE_BYTES);
    if(!bytes.length||!validSignature(bytes,mime))return json({ok:false,error:'图片内容无效，或格式与扩展名不符。'},400);
    let name='自定义壁纸';try{name=decodeURIComponent(request.headers.get('X-Wallpaper-Name')||name)}catch{}
    name=name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,90)||'自定义壁纸';
    const hash=shaHex(await crypto.subtle.digest('SHA-256',bytes));
    const same=await db.prepare('SELECT id FROM wallpaper_items WHERE sha256=? LIMIT 1').bind(hash).first();
    if(same)return json({ok:false,error:'壁纸库已经有这张原图，无需重复上传。'},409);
    const id=crypto.randomUUID();
    // Exactly one SQL INSERT enforces the 9-file cap atomically under concurrent requests.
    const inserted=await db.prepare(`INSERT INTO wallpaper_items(id,name,mime,size_bytes,data,sha256)
      SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM wallpaper_items)<9`)
      .bind(id,name,mime,bytes.length,bytes,hash).run();
    if(!Number(inserted.meta?.changes))return json({ok:false,error:'壁纸库已满（10/10），请先删除一张自定义壁纸。'},409);
    return json({ok:true,id,name,size:bytes.length,sha256:hash},201);
  }catch(err){return json({ok:false,error:String(err.message||err)},Number(err.status)||500)}
}
export async function onRequestDelete({request,env}){
  if(!dbOf(env))return unavailable();
  const auth=await admin(request,env);if(auth.error)return auth.error;
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!/^[0-9a-f-]{36}$/.test(id))return json({ok:false,error:'非法壁纸编号。'},400);
  try{
    await init(env);const db=dbOf(env);
    const item=await db.prepare('SELECT id FROM wallpaper_items WHERE id=? LIMIT 1').bind(id).first();
    if(!item)return json({ok:false,error:'壁纸不存在。'},404);
    const state=await current(db);
    if(state.id===id){await db.prepare(`INSERT INTO wallpaper_state(name,value,updated_at) VALUES('active','default',?)
      ON CONFLICT(name) DO UPDATE SET value='default',updated_at=excluded.updated_at`).bind(String(Date.now())).run()}
    await db.prepare('DELETE FROM wallpaper_items WHERE id=?').bind(id).run();
    const active=await current(db);
    return json({ok:true,active:active.id,version:active.version});
  }catch(err){return json({ok:false,error:String(err.message||err)},500)}
}
