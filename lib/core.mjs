import {createHmac,createHash,timingSafeEqual,randomUUID} from 'node:crypto';
export const MAX_BYTES=3_000_000;
export function fail(status,message){throw Object.assign(new Error(message),{status});}
export function equal(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());}
function sign(payload,env){return createHmac('sha256',env.SESSION_SECRET+env.STUDIO_PASSWORD).update(payload).digest('base64url');}
export function session(env,now=Date.now()){const data=Buffer.from(JSON.stringify({exp:now+12*60*60*1000,nonce:randomUUID()})).toString('base64url');return data+'.'+sign(data,env);}
export function authenticated(cookie,env,now=Date.now()) {try {const token=(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('studio_session='))?.slice(15);const [data,sig,...rest]=(token||'').split('.');return !rest.length&&!!sig&&equal(sig,sign(data,env))&&JSON.parse(Buffer.from(data,'base64url')).exp>now;}catch{return false;}}
export function slug(value){if(typeof value!=='string'||value.length>90||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))fail(400,'주소는 영문 소문자·숫자·하이픈으로 입력해 주세요.');return value;}
export function path(value){if(typeof value!=='string'||value.length>240||/[\x00-\x1f\\:]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))fail(400,'첨부 파일 경로가 올바르지 않습니다.');return value;}
export function validate(input){
 if(!input||typeof input!=='object')fail(400,'콘텐츠가 없습니다.');
 const out={slug:slug(input.slug)};
 for(const [key,max] of Object.entries({title:100,category:40,summary:1000,author:80,note:10000,verification:200,seoTitle:100,seoDescription:300})) {out[key]=String(input[key]||'').trim();if(out[key].length>max)fail(400,key+' 입력 길이를 확인해 주세요.');}
 if(!out.title)fail(400,'제목을 입력해 주세요.');
 if(!['scheduled','draft','needs_changes','ready','delivered','private'].includes(input.status))fail(400,'게시 상태가 올바르지 않습니다.');out.status=input.status;
 const reviewStatus=input.reviewStatus||'pending';if(!['pending','in_review','needs_revision','complete'].includes(reviewStatus))fail(400,'검토 상태가 올바르지 않습니다.');out.reviewStatus=reviewStatus;
 if(typeof input.html!=='string'||Buffer.byteLength(input.html)>2_000_000)fail(413,'HTML은 2MB 이내로 올려 주세요.');out.html=input.html;
 out.entryPath=path(input.entryPath||'index.html');
 if(!Array.isArray(input.assets)||input.assets.length>300)fail(400,'첨부 파일 목록을 확인해 주세요.');
 const seen=new Set([out.entryPath]);out.assets=input.assets.map(a=>{const p=path(a.path);if(seen.has(p))fail(400,'중복된 파일 경로입니다.');seen.add(p);if(typeof a.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.base64))fail(400,'첨부 파일 데이터가 올바르지 않습니다.');return {path:p,mime:String(a.mime||'application/octet-stream').slice(0,100),base64:a.base64};});
 for(const key of ['tags','sourceUrls']){const values=input[key]||[];if(!Array.isArray(values)||values.length>50||values.some(x=>typeof x!=='string'||x.length>2000))fail(400,'태그 또는 출처를 확인해 주세요.');out[key]=values;}
 out.scheduledAt=input.scheduledAt||null;if(out.scheduledAt&&!Number.isFinite(Date.parse(out.scheduledAt)))fail(400,'게시 예정일을 확인해 주세요.');
 if(Buffer.byteLength(JSON.stringify(out))>MAX_BYTES)fail(413,'글 한 편의 HTML과 첨부 파일 합계가 너무 큽니다. 이미지를 줄여 주세요. (전송 데이터 3MB 이내)');
 return out;
}
export function summary(r){const {html,assets,...rest}=r;return {...rest,assetCount:assets.length};}
export function nextRecord(input,current,expectedRevision,now=new Date().toISOString()){
 if((current?.revision||null)!==(expectedRevision||null))fail(409,'다른 팀원이 수정했습니다. 입력 내용을 복사한 뒤 목록을 새로고침해 주세요.');
 if(current?.deletedAt)fail(409,'휴지통의 글을 먼저 복원해 주세요.');
 return {...validate(input),createdAt:current?.createdAt||now,updatedAt:now,updatedBy:input.author||'팀 공용 관리자',revision:randomUUID(),history:current?[...(current.history||[]),{revision:current.revision,title:current.title,updatedAt:current.updatedAt,updatedBy:current.updatedBy,status:current.status}].slice(-20):[]};
}
