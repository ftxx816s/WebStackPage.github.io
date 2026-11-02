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
// V19.68: structural validation is NOT a header-only check. PNG additionally
// verifies every chunk's CRC and the full zlib stream without buffering pixels.
function u32be(b,p){return ((b[p]*16777216)+(b[p+1]<<16)+(b[p+2]<<8)+b[p+3])>>>0}
const PNG_SIG=[137,80,78,71,13,10,26,10];
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0}return t})();
function chunkCrc(b,start,end){let crc=0xffffffff;for(let i=start;i<end;i++)crc=CRC_TABLE[(crc^b[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
function pngExpectedBytes(w,h,bits,channels,interlace){
  const bytes=(pw,ph)=>pw>0&&ph>0?ph*(1+Math.ceil(pw*bits*channels/8)):0;
  if(!interlace)return bytes(w,h);
  const passes=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
  return passes.reduce((total,[x,y,dx,dy])=>total+bytes(Math.max(0,Math.ceil((w-x)/dx)),Math.max(0,Math.ceil((h-y)/dy))),0);
}
async function validPngV1968(b){
  if(b.length<57||!PNG_SIG.every((x,i)=>b[i]===x))return false;
  let pos=8,seenIHDR=false,seenIDAT=false,seenIEND=false,header=null,idat=[];
  while(pos+12<=b.length){
    const len=u32be(b,pos),dataStart=pos+8,end=dataStart+len,crcEnd=end+4;
    if(len>MAX_FILE_BYTES||crcEnd>b.length||end<dataStart)return false;
    const type=String.fromCharCode(...b.subarray(pos+4,pos+8));
    if(!/^[A-Za-z]{4}$/.test(type)||chunkCrc(b,pos+4,end)!==u32be(b,end))return false;
    if(!seenIHDR&&type!=='IHDR')return false;
    if(type==='IHDR'){
      if(seenIHDR||len!==13)return false;
      const w=u32be(b,dataStart),h=u32be(b,dataStart+4),depth=b[dataStart+8],color=b[dataStart+9],compression=b[dataStart+10],filter=b[dataStart+11],interlace=b[dataStart+12];
      const channels={0:1,2:3,3:1,4:2,6:4}[color];
      const validDepth={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}[color];
      if(!w||!h||w>16000||h>16000||w*h>100_000_000||!channels||!validDepth.includes(depth)||compression||filter||interlace>1)return false;
      header={w,h,depth,channels,interlace};seenIHDR=true;
    }else if(type==='IDAT'){
      if(seenIEND||!len)return false;
      seenIDAT=true;idat.push(b.subarray(dataStart,end));
    }else if(type==='IEND'){
      if(!seenIDAT||seenIEND||len!==0||crcEnd!==b.length)return false;
      seenIEND=true;break;
    }else if(type[0]===type[0].toUpperCase()&&!['PLTE'].includes(type))return false;
    pos=crcEnd;
  }
  if(!header||!seenIEND)return false;
  // Reject truncated / malformed IDAT streams and zip bombs.
  const expected=pngExpectedBytes(header.w,header.h,header.depth,header.channels,header.interlace);
  if(!Number.isSafeInteger(expected)||expected>300_000_000)return false;
  const compressed=new Uint8Array(idat.reduce((n,v)=>n+v.length,0));
  let offset=0;for(const part of idat){compressed.set(part,offset);offset+=part.length}
  try{
    const reader=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    let decoded=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;decoded+=value.byteLength;if(decoded>expected){await reader.cancel();return false}}}
    finally{try{reader.releaseLock()}catch{}}
    return decoded===expected;
  }catch{return false}
}
function validJpegV1968(b){
  if(b.length<64||b[0]!==255||b[1]!==216||b[b.length-2]!==255||b[b.length-1]!==217)return false;
  let pos=2,hasSOF=false,hasSOS=false;
  while(pos<b.length-2){
    if(b[pos]!==255){if(!hasSOS)return false;pos++;continue}
    while(pos<b.length&&b[pos]===255)pos++;
    const marker=b[pos++];
    if(marker===0)return false;
    if(marker===217)return hasSOF&&hasSOS&&pos===b.length;
    if(marker===216||marker===1||(marker>=208&&marker<=215))continue;
    if(pos+2>b.length)return false;
    const length=(b[pos]<<8)|b[pos+1];
    if(length<2||pos+length>b.length)return false;
    if((marker>=192&&marker<=207)&&![196,200,204].includes(marker)){
      if(length<8)return false;
      const h=(b[pos+3]<<8)|b[pos+4],w=(b[pos+5]<<8)|b[pos+6];
      if(!w||!h||w*h>100_000_000)return false;hasSOF=true;
    }
    if(marker===218){if(!hasSOF||length<6)return false;hasSOS=true}
    pos+=length;
    if(hasSOS){
      while(pos<b.length-1){
        if(b[pos]!==255){pos++;continue}
        const next=b[pos+1];if(next===0||next===255||(next>=208&&next<=215)){pos+=2;continue}
        break;
      }
      if(pos===b.length-2&&b[pos]===255&&b[pos+1]===217)return true;
    }
  }
  return false;
}
function validWebpV1968(b){
  if(b.length<32||String.fromCharCode(...b.subarray(0,4))!=='RIFF'||String.fromCharCode(...b.subarray(8,12))!=='WEBP'||u32beLE(b,4)+8!==b.length)return false;
  let pos=12,hasImage=false;
  while(pos+8<=b.length){
    const type=String.fromCharCode(...b.subarray(pos,pos+4)),len=u32beLE(b,pos+4);
    const start=pos+8,end=start+len;
    if(end>b.length)return false;
    if(type==='VP8 '){if(len<10||b[start+3]!==157||b[start+4]!==1||b[start+5]!==42)return false;hasImage=true}
    else if(type==='VP8L'){if(len<5||b[start]!==47)return false;hasImage=true}
    else if(type==='VP8X'){if(len!==10)return false}
    pos=end+(len&1);
  }
  return hasImage&&pos===b.length;
}
function u32beLE(b,p){return (b[p]+(b[p+1]<<8)+(b[p+2]<<16)+(b[p+3]*16777216))>>>0}
async function validImageV1968(bytes,mime){
  if(mime==='image/png')return validPngV1968(bytes);
  if(mime==='image/jpeg')return validJpegV1968(bytes);
  if(mime==='image/webp')return validWebpV1968(bytes);
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
    if(!bytes.length||!(await validImageV1968(bytes,mime)))return json({ok:false,error:'图片内容无效，或格式与扩展名不符。'},400);
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
