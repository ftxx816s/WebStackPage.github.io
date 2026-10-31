// V19.75 | Conservative link hygiene from Cloudflare's network.
// Cannot determine site accessibility from mainland China. Never writes to D1 or KV.
import {json, requireAuth, sameOrigin} from '../_shared/auth.js';

const MAX_BODY = 4096;
const TIMEOUT_MS = 7500;
const MAX_REDIRECTS = 4;
const BLOCKED_SUFFIXES = ['.local','.localhost','.internal','.test','.invalid','.example','.onion','.lan','.home','.arpa'];

function safeTarget(value){
  if(typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if(!['https:','http:'].includes(url.protocol) || url.username || url.password) return null;
    if(url.port && !['80','443'].includes(url.port)) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/,'');
    if(!host || !host.includes('.') || host.includes('..') || host.startsWith('.') || host.endsWith('.')) return null;
    if(host.startsWith('[') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host))return null; // prohibit IP literals, including public IPs
    if(BLOCKED_SUFFIXES.some(s=>host.endsWith(s)) || ['localhost','0.0.0.0'].includes(host))return null;
    if(!/^[a-z0-9.-]+$/.test(host))return null;
    if(host.split('.').some(label=>!label || label.length>63 || /^-|-$/.test(label) || !/^[a-z0-9-]+$/.test(label)))return null;
    url.hash='';
    return url;
  } catch {return null}
}

async function fetchOne(url){
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  try {
    const response=await fetch(url,{method:'GET',redirect:'manual',signal:ctrl.signal,
      headers:{'Accept':'text/html,application/xhtml+xml,*/*;q=0.5'}});
    return response;
  } finally {clearTimeout(timeout)}
}

async function requestFollowing(start){
  let url=start,redirected=false;
  const visited=new Set();
  for(let hops=0;hops<=MAX_REDIRECTS;hops++){
    if(visited.has(url.href))return {code:'limited',reason:'网站重定向循环，无法确认',status:0};
    visited.add(url.href);
    let response;
    try{response=await fetchOne(url.href)}
    catch(err){
      return {code:'limited',reason:err?.name==='AbortError'?'Cloudflare 探测超时，不代表网站失效':'Cloudflare 无法连接，不代表网站失效',status:0};
    }
    const status=response.status;
    const location=response.headers.get('location');
    try{response.body?.cancel?.()}catch{}
    if(status>=300 && status<400 && location){
      const next=safeTarget(new URL(location,url).href);
      if(!next)return {code:'limited',reason:'网站跳转到此探测器不支持的地址',status};
      url=next;redirected=true;continue;
    }
    if((status>=200 && status<300) || status===401){
      return {code:'ok',status,reason:status===401?'网站响应正常（需要登录）':redirected?'跳转后获得有效 HTTP 响应':'获得有效 HTTP 响应'};
    }
    if(status===404||status===410)return {code:'missing',status,reason:`HTTP ${status}：目标页面不存在`};
    if(status===403||status===407||status===408||status===418||status===429||status===451){
      return {code:'limited',status,reason:`HTTP ${status}：访问受限，不代表网站失效`};
    }
    if(status>=500)return {code:'limited',status,reason:`HTTP ${status}：Cloudflare/源站异常，不作为失效依据`};
    return {code:'limited',status,reason:`HTTP ${status}：不能确认网站失效`};
  }
  return {code:'limited',status:0,reason:'跳转次数过多，不作为失效依据'};
}

async function checkUrl(url){
  const first=await requestFollowing(url);
  if(first.code!=='missing')return first;
  // When a deep bookmark gives 404/410, a working homepage means the SITE is alive.
  // Distinguish a broken saved path from a dead website; never mark it as a dead site.
  const root=new URL('/',url.origin);
  if(url.pathname==='/' && !url.search)return first;
  const home=await requestFollowing(root);
  if(home.code==='ok')return {code:'path',status:first.status,reason:`收藏路径 HTTP ${first.status}，但网站首页可访问`,suggestedUrl:root.href};
  if(home.code==='missing')return {...first,reason:`收藏路径与网站首页均返回 HTTP ${first.status}/${home.status}`};
  return {code:'limited',status:first.status,reason:'收藏路径不存在，但 Cloudflare 无法确认网站首页状态'};
}

export async function onRequestPost({request,env}){
  const auth=await requireAuth(request,env);
  if(auth.error)return auth.error;
  if(!sameOrigin(request))return json({ok:false,error:'Origin mismatch'},403);
  const len=Number(request.headers.get('content-length')||0);
  if(len>MAX_BODY)return json({ok:false,error:'Request too large'},413);
  let body;
  try {
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>MAX_BODY)return json({ok:false,error:'Request too large'},413);
    body=JSON.parse(raw);
  } catch {return json({ok:false,error:'Invalid JSON'},400)}
  const url=safeTarget(body?.url);
  // IP URLs or private/nonstandard hosts can't be safely fetched from Cloudflare Workers.
  // Unsupported is not a dead site and must never enter cleanup candidates.
  if(!url){
    return json({ok:true,code:'unsupported',status:0,reason:'IP、内网或特殊端口链接不支持云端探测，不能据此判失效',checkedAt:Date.now(),scope:'cloudflare-edge'});
  }
  const t=Date.now();
  const result=await checkUrl(url);
  return json({ok:true,code:result.code,status:result.status,reason:result.reason,
    ...(result.suggestedUrl?{suggestedUrl:result.suggestedUrl}:{}),
    durationMs:Date.now()-t,checkedAt:Date.now(),scope:'cloudflare-edge'});
}
