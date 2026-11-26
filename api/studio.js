import {createHash} from 'node:crypto';
import {authenticated,session,equal,fail,slug,validate,nextRecord,summary,thumbnailLinks,MAX_BYTES} from '../lib/core.mjs';
import {read,write,list,remove,removePrefix} from '../lib/storage.mjs';
import {loadTagDict,normalizeRecordTags,retagAll} from '../lib/tags-store.mjs';
import {topicLabels,tagGroups} from '../lib/tags.mjs';
import {normalizePalettes,isHexColor,DEFAULT_PALETTES} from '../public/thumbnail-palettes.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const env=process.env;const op=String(req.query?.op||'');
 const send=(code,data)=>res.status(code).json(data);
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'허용되지 않은 요청입니다.');
  if(!env.STUDIO_PASSWORD||env.STUDIO_PASSWORD.length<16||!env.SESSION_SECRET||env.SESSION_SECRET.length<32||!env.APP_ORIGIN||!env.S3_BUCKET||!env.AWS_REGION)fail(503,'사이트 연결 설정이 필요합니다. Vercel 환경변수와 AWS S3 설정을 완료해 주세요.');
  if(req.method==='POST'&&req.headers.origin!==new URL(env.APP_ORIGIN).origin)fail(403,'사이트 주소를 확인한 뒤 다시 접속해 주세요.');
  let body=req.body||{};if(typeof body==='string'){if(Buffer.byteLength(body)>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');try{body=JSON.parse(body);}catch{fail(400,'잘못된 요청입니다.');}}
  if(Buffer.byteLength(JSON.stringify(body))>MAX_BYTES+10000)fail(413,'전송 용량이 너무 큽니다.');
  const mutations=['login','logout','save','delete','restore','emptyTrash','saveSettings','saveHomeqSettings','generateHomeqWeekly','retagAll'];if(mutations.includes(op)&&req.method!=='POST')fail(405,'POST 요청이 필요합니다.');
  const cookie=(value,age)=>res.setHeader('Set-Cookie',`studio_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`);
  if(op==='login'){
   // Vercel overwrites this header; do not use a user-provided forwarding header.
   const ip=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown');
   const key='studio/auth/'+createHash('sha256').update(ip).digest('hex')+'.json';const old=await read(key);const now=Date.now();
   const attempts=old&&old.value.until>now?old.value:{count:0,until:now+15*60*1000};
   if(attempts.count>=10)fail(429,'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');
   await write(key,{...attempts,count:attempts.count+1},old?.etag);
   if(typeof body.password!=='string'||!equal(body.password,env.STUDIO_PASSWORD))fail(401,'비밀번호가 일치하지 않습니다.');
   cookie(session(env),43200);return send(200,{user:{name:'팀 공용 관리자'}});
  }
  if(op==='logout'){cookie('',0);return send(200,{ok:true});}
  if(!authenticated(req.headers.cookie,env))fail(401,'로그인이 필요합니다.');
  if(op==='session')return send(200,{user:{name:'팀 공용 관리자'}});
  if(op==='list'){
   const records=await list();
   let dict=null;try{dict=(await loadTagDict()).dict;}catch(e){console.error('Tag dictionary load failed',e.name);}
   const items=records.filter(r=>req.query.trash==='1'?!!r.deletedAt:!r.deletedAt).map(r=>({...summary(r),topicTags:dict?topicLabels(r,dict):[]}));
   return send(200,{items,tagGroups:dict?tagGroups(items,dict):[]});
  }
  if(op==='retagAll')return send(200,await retagAll({dryRun:body.dryRun!==false}));
  if(op==='getSettings'){
   const saved=await read('studio/settings/automation.json');return send(200,{settings:saved?{...saved.value,thumbnailPalettes:normalizePalettes(saved.value.thumbnailPalettes)}:null});
  }
  if(op==='saveSettings'){
   const writingRules=String(body.settings?.writingRules||'').trim();
   if(writingRules.length<10)fail(400,'작성 규칙을 10자 이상 입력해 주세요.');
   if(writingRules.length>20000)fail(400,'작성 규칙은 20,000자까지 저장할 수 있습니다.');
   const supplied=body.settings?.thumbnailPalettes;
    if(supplied){if(!Array.isArray(supplied.sets)||supplied.sets.length>17||!supplied.types||typeof supplied.types!=='object')fail(400,'대표 이미지 색상 세트를 확인해 주세요.');
     if(supplied.sets.some(s=>!s||typeof s.id!=='string'||typeof s.name!=='string'||s.name.length>20||!isHexColor(s.main)))fail(400,'색상 세트 이름과 메인 색상을 확인해 주세요.');
     if(DEFAULT_PALETTES.some(p=>!supplied.sets.some(s=>s.id===p.id)))fail(400,'기본 색상 세트를 유지해 주세요.');
     if(['guide','insight','workbook'].some(t=>!supplied.sets.some(s=>s.id===supplied.types[t])))fail(400,'콘텐츠 유형별 색상 세트를 선택해 주세요.');}
    const key='studio/settings/automation.json';const current=await read(key);
   if(current&&body.expectedRevision!==current.value.revision)fail(409,'다른 팀원이 작성 규칙을 수정했습니다. 새로고침 후 다시 시도해 주세요.');
   const versionNumber=(Number(current?.value?.versionNumber)||1)+1;const updatedAt=new Date().toISOString();
   const thumbnailPalettes=normalizePalettes(supplied||current?.value?.thumbnailPalettes);
    const next={writingRules,thumbnailPalettes,versionNumber,ruleVersion:'v1.'+versionNumber,updatedAt,revision:createHash('sha256').update(writingRules+JSON.stringify(thumbnailPalettes)+updatedAt).digest('hex').slice(0,20)};
   await write(key,next,current?.etag);return send(200,{settings:next});
  }
  if(op==='getHomeqSettings'){
   const saved=await read('studio/settings/homeq-weekly-news.json');return send(200,{settings:saved?.value||null});
  }
  if(op==='saveHomeqSettings'){
   const source=body.settings||{};
   const writingRules=String(source.writingRules||'').trim();
   if(writingRules.length<20)fail(400,'주간뉴스 작성 규칙을 20자 이상 입력해 주세요.');
   if(writingRules.length>20000)fail(400,'작성 규칙은 20,000자까지 저장할 수 있습니다.');
   const weekday=String(source.weekday||'수');if(!['월','화','수','목','금','토','일'].includes(weekday))fail(400,'실행 요일을 확인해 주세요.');
   const time=String(source.time||'09:00');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail(400,'실행 시각을 확인해 주세요.');
   const topicCount=Number(source.topicCount);if(!Number.isInteger(topicCount)||topicCount<1||topicCount>5)fail(400,'뉴스 꼭지 수는 1~5개로 설정해 주세요.');
   const next={weekday,time,topicCount,canvas:{width:1080,height:1440},templateName:'주간뉴스(기존ver.)',writingRules,updatedAt:new Date().toISOString()};
   const key='studio/settings/homeq-weekly-news.json';const current=await read(key);
   if(current&&body.expectedRevision!==current.value.revision)fail(409,'다른 팀원이 주간뉴스 설정을 수정했습니다. 새로고침 후 다시 시도해 주세요.');
   const versionNumber=(Number(current?.value?.versionNumber)||0)+1;next.versionNumber=versionNumber;next.ruleVersion='v1.'+versionNumber;next.revision=createHash('sha256').update(JSON.stringify(next)).digest('hex').slice(0,20);
   await write(key,next,current?.etag);return send(200,{settings:next});
  }
  if(op==='getHomeqWeekly'){
   const week=String(req.query.week||'');if(!/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(week))fail(400,'대상 주차를 확인해 주세요.');
   const saved=await read('studio/homeq/weekly/'+week+'.json');return send(200,{item:saved?.value||null});
  }
  if(op==='generateHomeqWeekly'){
   const {validateHomeqWeek,generateHomeqWeekly,DEFAULT_HOMEQ_RULES}=await import('../lib/homeq-weekly.mjs');
   const targetWeek=validateHomeqWeek(body.targetWeek);const topicMode=String(body.topicMode||'auto');if(!['auto','review'].includes(topicMode))fail(400,'주제 선정 방식을 확인해 주세요.');
   const settings=(await read('studio/settings/homeq-weekly-news.json'))?.value||{topicCount:3,writingRules:DEFAULT_HOMEQ_RULES,ruleVersion:'기본값'};
   const topicCount=Number(settings.topicCount)||3;const now=new Date();const today=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long'}).format(now);let generated;
   try{generated=await generateHomeqWeekly({targetWeek,topicCount,writingRules:settings.writingRules||DEFAULT_HOMEQ_RULES,today});}
   catch(error){const status=error?.statusCode||error?.status;const gatewayMessage=String(error?.message||'').replace(/\s*\[[^\]]+\]\s*$/,'').slice(0,300);console.error('HomeQ AI generation failed',error?.name,{status,code:error?.code,message:gatewayMessage});if(status===403&&/customer[_ -]?verification|payment method|billing|credit card|add-credit-card/i.test(gatewayMessage))fail(503,'Vercel AI Gateway 사용을 위해 Vercel 결제수단 확인이 필요합니다. Vercel의 AI Gateway 화면에서 결제수단을 등록한 뒤 다시 시도해 주세요.');if(status===403&&/access[_ -]?policy|forbidden|denied/i.test(gatewayMessage))fail(503,'Vercel AI Gateway 접근 정책에서 현재 모델 사용이 차단되었습니다. AI Gateway 정책을 확인해 주세요.');if([401,403].includes(status))fail(503,'Vercel AI Gateway 연결은 되었지만 계정 이용 승인이 필요합니다. Vercel AI Gateway 화면에서 결제수단 및 사용 권한을 확인해 주세요.');if(status===402)fail(503,'AI 사용 한도를 확인해 주세요. Vercel AI Gateway 크레딧이 필요합니다.');fail(503,'AI 원고 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');}
   const key='studio/homeq/weekly/'+targetWeek+'.json';const current=await read(key);const next={id:'homeq-weekly-'+targetWeek,targetWeek,topicMode,status:topicMode==='review'?'topic_review':'draft',model:'openai/gpt-5.4-mini',ruleVersion:settings.ruleVersion||'기본값',createdAt:current?.value?.createdAt||now.toISOString(),updatedAt:now.toISOString(),versionNumber:(Number(current?.value?.versionNumber)||0)+1,...generated};
   next.revision=createHash('sha256').update(JSON.stringify(next)).digest('hex').slice(0,20);await write(key,next,current?.etag);return send(200,{item:next});
  }
  if(op==='emptyTrash'){
   const items=body.items;
   if(!Array.isArray(items)||items.length>500)fail(400,'휴지통 항목을 확인해 주세요.');
   let deleted=0;const skipped=[];
   for(const item of items){
    const id=slug(item?.slug);const key='studio/records/'+id+'.json';const current=await read(key);
    if(!current||!current.value.deletedAt||current.value.revision!==item.revision){skipped.push(id);continue;}
    await removePrefix('studio/versions/'+id+'/');
    await remove('studio/github/'+id+'.json');
    await remove(key);deleted++;
   }
   return send(200,{deleted,skipped});
  }
  const id=slug(req.query.slug||body.slug||body.record?.slug);const key='studio/records/'+id+'.json';const current=await read(key);
  if(op==='thumbnail'){if(!current||current.value.deletedAt)fail(404,'콘텐츠가 없습니다.');const path=String(req.query.path||'');const asset=current.value.assets.find(a=>a.path===path);if(!asset||!String(asset.mime||'').startsWith('image/'))fail(404,'썸네일을 찾을 수 없습니다.');res.setHeader('Content-Type',asset.mime);res.setHeader('Cache-Control','private, max-age=300');return res.status(200).send(Buffer.from(asset.base64,'base64'));}
  if(op==='get'){if(!current||current.value.deletedAt)fail(404,'콘텐츠가 없습니다.');return send(200,{...current.value,imageLinks:thumbnailLinks(current.value,env)});}
  if(op==='version'){const revision=String(req.query.revision||'');if(!current||!current.value.history.some(x=>x.revision===revision))fail(404,'수정 이력이 없습니다.');const version=await read('studio/versions/'+id+'/'+revision+'.json');if(!version)fail(404,'수정 이력이 없습니다.');return send(200,version.value);}
  if(op==='save'){
   // 주제 태그를 바꿨을 때만 사전 표기로 맞춘다(바꾸지 않은 예전 글은 그대로 저장). 사전 저장소 문제로 저장이 막히지 않게 한다.
   const sameTags=JSON.stringify(body.record?.tags||[])===JSON.stringify(current?.value?.tags||[]);
   if(body.record&&Array.isArray(body.record.tags)&&!sameTags){
    try{const t=await normalizeRecordTags(body.record,{mode:'explicit'});body.record={...body.record,tags:t.tags,keywords:t.keywords};}
    catch(e){console.error('Tag normalize failed',e.name);}
   }
   const next=nextRecord(body.record,current?.value,body.expectedRevision);
   if(current){try{await write('studio/versions/'+id+'/'+current.value.revision+'.json',current.value);}catch(e){if(e.$metadata?.httpStatusCode!==412)throw e;}}
   await write(key,next,current?.etag);return send(200,next);
  }
  if(op==='delete'||op==='restore'){
   if(!current)fail(404,'콘텐츠가 없습니다.');if(current.value.revision!==body.expectedRevision)fail(409,'다른 팀원이 수정했습니다. 목록을 새로고침해 주세요.');
   const next={...current.value,deletedAt:op==='delete'?new Date().toISOString():null};await write(key,next,current.etag);return send(200,{ok:true});
  }
  fail(400,'지원하지 않는 요청입니다.');
 }catch(e){if([409,412].includes(e.$metadata?.httpStatusCode))return send(409,{error:'동시에 변경된 내용이 있습니다. 다시 시도해 주세요.'});if(e.status)return send(e.status,{error:e.message});if(e.name==='AccessDenied'||e.Code==='AccessDenied')return send(403,{error:'AWS S3 권한이 부족합니다. IAM 정책에 studio 경로의 s3:DeleteObject 권한과 studio/versions/ 목록 권한을 추가해 주세요.'});console.error('Studio request failed',e.name,{code:typeof e.code==='string'?e.code.replace(/[^A-Z_0-9]/g,'').slice(0,60):undefined,frames:String(e.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,6)});return send(503,{error:'저장소에 연결할 수 없습니다. AWS 연결 정보와 권한을 확인해 주세요.'});}
}
