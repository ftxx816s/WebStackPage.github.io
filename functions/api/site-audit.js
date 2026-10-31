// V19.74 | Lightweight link hygiene check. This endpoint NEVER modifies D1/KV.
// It probes from Cloudflare's network, not from the visitor's browser or VPN.
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
    if(host.startsWith('[') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host))return null; // no IP literals
    if(BLOCKED_SUFFIXES.some(s=>host.endsWith(s)) || ['localhost','0.0.0.0'].includes(host))return null;
    if(!/^[a-z0-9.-]+$/.test(host))return null;
    // Reject hostnames with empty/non-DNS labels, including hyphen-prefixed labels.
    if(host.split('.').some(label=>!label || label.length>63 || /^-|-$/.test(label) || !/^[a-z0-9-]+$/.test(label)))return null;
    url.hash='';
    return url;
  } catch {return null}
}

async function fetchOne(url,method){
  const ctrl=new AbortController();
  const timeout=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);
  let response;
  try {
    response=await fetch(url,{
      method,redirect:'manual',signal:ctrl.signal,
      headers:{'Accept':'text/html,application/xhtml+xml,*/*;q=0.5'}
    });
    return {response, url};
  } finally {clearTimeout(timeout)}
}

async function requestFollowing(start,method){
  let url=start, redirected=false;
  const visited=new Set();
  for(let hops=0;hops<=MAX_REDIRECTS;hops++){
    if(visited.has(url.href))return {code:'review',reason:'重定向循环',status:0};
    visited.add(url.href);
    let response;
    try{({response}=await fetchOne(url.href,method))}
    catch(err){
      const error=err?.name==='AbortError'?'请求超时':'网络或服务器拒绝探测';
      return {code:'failed',reason:error,status:0};
    }
    const status=response.status;
    const location=response.headers.get('location');
    try{response.body?.cancel?.()}catch{}
    if(status>=300 && status<400 && location){
      const next=safeTarget(new URL(location,url).href);
      if(!next)return {code:'review',status,reason:'跳转到不支持或不安全的地址'};
      url=next;redirected=true;continue;
    }
    if(status>=200 && status<300)return {code:'ok',status,reason:redirected?'跳转后获得正常响应':'获得正常 HTTP 响应'};
    if(status===404 || status===410)return {code:'missing',status,reason:status===404?'链接返回 HTTP 404':'链接返回 HTTP 410'};
    if([401,403,407,408,418,429,451].includes(status))return {code:'review',status,reason:`HTTP ${status}（可能需要登录、地区访问或受到限制）`};
    if(status>=500)return {code:'failed',status,reason:`服务器返回 HTTP ${status}`};
    return {code:'review',status,reason:`HTTP ${status}，无法确认网页是否可用`};
  }
  return {code:'review',status:0,reason:'重定向次数过多'};
}

async function checkUrl(url){
  // GET only: one HTTP request per attempt, without downloading the body.
  // HEAD is frequently handled differently from actual page navigation.
  return await requestFollowing(url,'GET');
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
  if(!url)return json({ok:false,error:'URL must be a public HTTP(S) hostname using a standard port'},400);
  const t=Date.now();
  const result=await checkUrl(url);
  return json({ok:true,code:result.code,status:result.status,reason:result.reason,
    durationMs:Date.now()-t,checkedAt:Date.now(),scope:'cloudflare-edge'});
}
