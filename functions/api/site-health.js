const BLOCKED_HOSTS = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe8[0-9a-f]:)/i;
const BLOCKED_NAMES = /(?:^|\.)(?:localhost|local|internal|home|lan)$/i;
const RESTRICTED = new Set([400, 401, 403, 405, 406, 407, 409, 418, 422, 423, 425, 426, 429, 451]);
const PATH_DEAD = new Set([404, 410]);
const RETRY_DELAYS = [260, 620];

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function normalizeUrl(value){
  try{
    const u=new URL(String(value||'').trim());
    if(!/^https?:$/.test(u.protocol))return null;
    const host=u.hostname.toLowerCase();
    if(BLOCKED_HOSTS.test(host)||BLOCKED_NAMES.test(host)||host==='metadata.google.internal')return null;
    u.hash='';return u.toString();
  }catch{return null}
}
function verdictForStatus(status){
  if(status>=200&&status<400)return 'healthy';
  if(PATH_DEAD.has(status))return 'path_dead';
  if(RESTRICTED.has(status))return 'restricted';
  if(status>=500&&status<=599)return 'service_error';
  if(status>=400&&status<500)return 'restricted';
  return 'unreachable';
}
async function probeOnce(url,timeoutMs=4600){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const started=Date.now();
  try{
    const res=await fetch(url,{
      method:'GET',redirect:'follow',signal:controller.signal,
      cf:{cacheTtl:0,cacheEverything:false},
      headers:{
        'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7',
        'accept-language':'zh-CN,zh;q=0.9,en;q=0.7',
        'cache-control':'no-cache','pragma':'no-cache',
        'user-agent':'Mozilla/5.0 (compatible; PrivateNavHealth/18.84)'
      }
    });
    const status=res.status,ms=Math.max(1,Date.now()-started),finalUrl=res.url||url;
    try{await res.body?.cancel()}catch{}
    return {ok:status>=200&&status<400,status,ms,finalUrl,verdict:verdictForStatus(status)};
  }catch(err){
    return {ok:false,status:0,ms:Math.max(1,Date.now()-started),finalUrl:url,verdict:'unreachable',error:err?.name==='AbortError'?'timeout':String(err?.message||'network error').slice(0,160)};
  }finally{clearTimeout(timer)}
}
function needsRetry(r){return r?.verdict==='unreachable'||r?.verdict==='service_error'}
async function probeWithRetries(url){
  const attempts=[];let last=null;
  for(let i=0;i<3;i++){
    last=await probeOnce(url);attempts.push(last);
    if(!needsRetry(last))break;
    if(i<2)await sleep(RETRY_DELAYS[i]||400);
  }
  const healthy=attempts.find(x=>x.verdict==='healthy');
  let verdict='unreachable',unstable=false;
  if(healthy){verdict='healthy';unstable=attempts.some(x=>x.verdict!=='healthy');last=healthy}
  else if(attempts.some(x=>x.verdict==='path_dead'))verdict='path_dead';
  else if(attempts.some(x=>x.verdict==='restricted'))verdict='restricted';
  else if(attempts.some(x=>x.verdict==='service_error'))verdict='service_error';

  let root=null;
  try{
    const u=new URL(url),rootUrl=`${u.protocol}//${u.host}/`;
    if(rootUrl!==url&&(verdict==='path_dead'||verdict==='unreachable'||verdict==='service_error')){
      root=await probeOnce(rootUrl,4200);
      if(verdict==='unreachable'&&['healthy','restricted'].includes(root.verdict))verdict='host_reachable';
    }
  }catch{}
  const failures=attempts.filter(x=>!x.ok).length;
  return {url,verdict,unstable,ok:verdict==='healthy',status:last?.status||0,ms:last?.ms||0,finalUrl:last?.finalUrl||url,error:last?.error||'',attempts:attempts.map(x=>({status:x.status,ms:x.ms,verdict:x.verdict,error:x.error||''})),attemptCount:attempts.length,failures,allFailed:attempts.length>=3&&failures===attempts.length,root:root?{status:root.status,verdict:root.verdict,ok:root.ok,ms:root.ms}:null};
}
export async function onRequestPost({request}){
  let body;try{body=await request.json()}catch{return Response.json({error:'invalid_json'},{status:400})}
  const raw=Array.isArray(body?.urls)?body.urls:[];
  const urls=[...new Set(raw.map(normalizeUrl).filter(Boolean))].slice(0,8);
  if(!urls.length)return Response.json({results:[],checkedAt:Date.now(),version:'18.84'});
  const results=await Promise.all(urls.map(probeWithRetries));
  return Response.json({results,checkedAt:Date.now(),version:'18.84'},{headers:{'cache-control':'no-store','content-type':'application/json; charset=utf-8'}});
}
export async function onRequestGet(){
  return Response.json({ok:true,service:'site-health',version:'18.84',strategy:'browser reachability + cloud status + manual confirmation'},{headers:{'cache-control':'no-store'}});
}
