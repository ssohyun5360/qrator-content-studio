import {read,write} from './storage.mjs';
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
