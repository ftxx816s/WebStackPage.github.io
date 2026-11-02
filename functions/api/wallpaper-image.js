// V19.58 — lossless byte-for-byte serving from a separate D1. Selected image is public
// because the navigation home page itself is public; other library images require admin cookie.
import {verifySession,json} from '../_shared/auth.js';
export async function onRequestGet({request,env}){
  const db=env.WALLPAPER_DB;
  if(!db)return json({ok:false,error:'WALLPAPER_DB not configured'},503);
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!/^[0-9a-f-]{36}$/.test(id))return new Response('Bad id',{status:400});
  try{
    const current=await db.prepare("SELECT value FROM wallpaper_state WHERE name='active' LIMIT 1").first();
    const isPublic=String(current?.value||'default')===id;
    if(!isPublic){const admin=await verifySession(request,env);if(!admin)return new Response('Unauthorized',{status:401})}
    const item=await db.prepare('SELECT mime,data,sha256 FROM wallpaper_items WHERE id=? LIMIT 1').bind(id).first();
    if(!item)return new Response('Not found',{status:404});
    const raw=item.data;
    const bytes=raw instanceof Uint8Array?raw:raw instanceof ArrayBuffer?new Uint8Array(raw):new Uint8Array(raw||[]);
    const etag='"'+String(item.sha256)+'"';
    if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':'private,max-age=3600'}});
    return new Response(bytes,{headers:{'Content-Type':String(item.mime),'Content-Length':String(bytes.length),
      'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','ETag':etag,'Vary':'Cookie'}});
  }catch(err){return json({ok:false,error:'壁纸读取失败：'+String(err.message||err)},500)}
}
