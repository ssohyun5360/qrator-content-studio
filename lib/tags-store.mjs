import {read,write,list} from './storage.mjs';
import {computeTags} from './tags.mjs';
import seed from './ai/rules/v1/tags.json' with {type:'json'};

const KEY='studio/settings/tag-dictionary.json';

// 규칙(개수·공통 키워드·분류 중복·그룹)은 항상 코드의 시작 파일을 따르고, 태그 목록만 저장본을 따른다.
function build(stored){
 const tags=stored?.tags?structuredClone(stored.tags):structuredClone(seed.tags);
 if(stored&&(Number(stored.seedVersion)||0)<seed.seedVersion){
  const ids=new Set(tags.map(t=>t.id));
  for(const t of seed.tags)if(!ids.has(t.id))tags.push(structuredClone(t));
 }
 return {seedVersion:seed.seedVersion,rules:seed.rules,keywordOnly:seed.keywordOnly,categoryDuplicates:seed.categoryDuplicates,groups:seed.groups,tags};
}

export async function loadTagDict(){
 const found=await read(KEY);
 return {dict:build(found?.value),etag:found?.etag||null};
}

export async function saveTagDict(dict,etag){
 await write(KEY,{seedVersion:dict.seedVersion,updatedAt:new Date().toISOString(),tags:dict.tags},etag||undefined);
}

// 예전 글의 긴 태그 목록을 주제 태그(2~4개) + 검색 키워드로 일괄 정리한다. 이미 정리된 글(사전 표기 2~4개)은 건드리지 않는다.
// 수정 이력·검토 상태·수정 시각은 그대로 두고 tags/keywords 만 바꾼다. dryRun 이면 저장 없이 계획만 돌려준다.
export async function retagAll({dryRun=true}={}){
 const records=(await list()).filter(r=>!r.deletedAt);
 const {dict,etag}=await loadTagDict();
 const labels=new Set(dict.tags.map(t=>t.label));
 let working=dict,dictChanged=false;
 const plan=[];
 for(const r of records){
  const tags=r.tags||[];
  if(tags.length>=2&&tags.length<=4&&tags.every(t=>labels.has(t)))continue;
  const res=computeTags({inputs:[...tags,...(r.keywords||[])],dict:working,category:r.category});
  if(JSON.stringify(res.tags)===JSON.stringify(tags)&&JSON.stringify(res.keywords)===JSON.stringify(r.keywords||[]))continue;
  working=res.dict;if(res.changed)dictChanged=true;
  plan.push({slug:r.slug,title:r.title,before:tags.length,tags:res.tags,keywords:res.keywords,added:res.added.map(t=>t.label)});
 }
 const preview=plan.map(({slug,title,before,tags,added})=>({slug,title,before,tags,added}));
 if(dryRun)return {dryRun:true,total:records.length,count:plan.length,items:preview};
 if(dictChanged)await saveTagDict(working,etag);
 let done=0;const failed=[];
 for(const p of plan){
  try{
   const found=await read('studio/records/'+p.slug+'.json');
   if(!found||found.value.deletedAt)throw new Error('gone');
   await write('studio/records/'+p.slug+'.json',{...found.value,tags:p.tags,keywords:p.keywords},found.etag);done++;
  }catch(e){failed.push(p.slug);}
 }
 return {dryRun:false,total:records.length,count:plan.length,done,failed,items:preview};
}

// 글의 tags(주제 태그)·keywords(검색 키워드)를 사전 기준으로 정리한다. 새 태그·동의어 합치기가 생기면 사전도 저장한다.
// mode 'inputs': 글에 들어온 해시태그 목록에서 사전과 맞는 것을 고른다(자동 등록·AI 생성).
// mode 'explicit': 사람이 고른 태그를 그대로 존중해 사전 표기로 맞춘다(스튜디오에서 직접 저장).
export async function normalizeRecordTags(record,{mode='inputs',explicit=null}={}){
 for(let attempt=0;attempt<3;attempt++){
  const {dict,etag}=await loadTagDict();
  const r=mode==='explicit'
   ?computeTags({explicit:record.tags||[],dict,category:record.category})
   :computeTags({inputs:[...(record.tags||[]),...(record.keywords||[])],explicit,dict,category:record.category});
  if(r.changed){
   try{await saveTagDict(r.dict,etag);}
   catch(e){if([409,412].includes(e.$metadata?.httpStatusCode)){continue;}throw e;}
  }
  const keywords=mode==='explicit'?[...new Set([...(record.keywords||[]),...(record.tags||[]).filter(t=>!r.tags.includes(t))])]:r.keywords;
  return {tags:r.tags,keywords:keywords.slice(0,50),added:r.added.map(t=>t.label),merged:r.merged,skipped:r.skipped};
 }
 throw Object.assign(new Error('태그 사전이 동시에 수정되었습니다. 잠시 후 다시 시도해 주세요.'),{status:409});
}
