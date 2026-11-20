import {createHash} from 'node:crypto';

// 주제 태그 사전 로직(순수 함수). 저장·불러오기는 tags-store.mjs 가 맡는다.
export const norm=s=>String(s??'').normalize('NFC').replace(/^#/,'').replace(/[\s·・‧_\-()（）[\]]/g,'').toLowerCase();

export function bigrams(s){const n=norm(s),set=new Set();for(let i=0;i<n.length-1;i++)set.add(n.slice(i,i+2));return set;}
export function similarity(a,b){
 const A=bigrams(a),B=bigrams(b);if(!A.size||!B.size)return 0;
 let hit=0;for(const x of A)if(B.has(x))hit++;
 return hit/(A.size+B.size-hit);
}

export function buildIndex(dict){
 const index=new Map();
 for(const tag of dict.tags)for(const term of [tag.label,...(tag.aliases||[])])index.set(norm(term),tag);
 return index;
}

export function inScope(tag,category){
 if(!tag.categories?.length)return true;
 const c=norm(category);
 return tag.categories.some(x=>c.includes(norm(x).slice(0,2)));
}

const CLEAN=s=>String(s??'').replace(/^#/,'').trim();

// 입력 문자열 목록을 주제 태그 / 나머지(키워드)로 나눈다. 사전에 없는 말은 candidates 로 돌려준다.
export function classify(inputs,dict,{category=''}={}){
 const index=buildIndex(dict);
 const keywordOnly=new Set(dict.keywordOnly.map(norm)),categoryDup=new Set(dict.categoryDuplicates.map(norm));
 const topic=[],candidates=[],keywords=[];
 for(const raw of inputs||[]){
  const s=CLEAN(raw);if(!s)continue;
  keywords.push(s);
  const key=norm(s);
  if(keywordOnly.has(key)||categoryDup.has(key))continue;
  const tag=index.get(key);
  if(tag){if(inScope(tag,category)&&!topic.some(t=>t.id===tag.id))topic.push(tag);continue;}
  candidates.push(s);
 }
 return {topic,candidates,keywords:[...new Set(keywords)]};
}

export function labelProblem(label,dict){
 const r=dict.rules,s=CLEAN(label),n=[...s].length;
 if(n<r.minLabelLength||n>r.maxLabelLength)return `태그 이름은 ${r.minLabelLength}~${r.maxLabelLength}자로 써 주세요.`;
 if(/^[\d\s]+$/.test(s))return '숫자만으로 된 태그는 만들 수 없어요.';
 if(/[<>"'`\\]|https?:/i.test(s))return '태그에 쓸 수 없는 문자가 있어요.';
 if(dict.keywordOnly.map(norm).includes(norm(s))||dict.categoryDuplicates.map(norm).includes(norm(s)))return '분류나 공통 키워드와 같은 뜻이라 태그로 만들지 않아요.';
 return null;
}

// 사전에 없는 이름을 처리한다: 비슷한 기존 태그가 있으면 그 태그의 동의어로 합치고, 아니면 새 태그로 추가한다(승인 없이).
// 반환한 dict 는 복사본이다. maxNew 를 넘는 새 태그는 만들지 않고 skipped 로 돌려준다.
export function resolveUnknown(names,dict,{maxNew=dict.rules.maxNewPerPost,category='',now=new Date().toISOString()}={}){
 const next=structuredClone(dict);
 const picked=[],merged=[],added=[],skipped=[];
 for(const raw of names||[]){
  const s=CLEAN(raw);if(!s)continue;
  const index=buildIndex(next),key=norm(s);
  const hit=index.get(key);
  if(hit){if(!picked.some(t=>t.id===hit.id))picked.push(hit);continue;}
  const problem=labelProblem(s,next);
  if(problem){skipped.push({name:s,reason:problem});continue;}
  let best=null,bestScore=0;
  for(const tag of next.tags){
   for(const term of [tag.label,...(tag.aliases||[])]){
    const t=norm(term);
    let score=similarity(s,term);
    if(key.length>=3&&t.length>=3&&(t.includes(key)||key.includes(t)))score=Math.max(score,0.9);
    if(score>bestScore){bestScore=score;best=tag;}
   }
  }
  if(best&&bestScore>=next.rules.similarityMerge){
   best.aliases=[...new Set([...(best.aliases||[]),s])];
   if(!picked.some(t=>t.id===best.id))picked.push(best);
   merged.push({name:s,into:best.label});continue;
  }
  if(added.length>=maxNew){skipped.push({name:s,reason:`새 태그는 글당 ${maxNew}개까지만 추가해요.`});continue;}
  const tag={id:'auto-'+createHash('sha1').update(norm(s)).digest('hex').slice(0,8),label:s,group:'기타',categories:[],aliases:[],source:'auto',addedAt:now};
  next.tags.push(tag);added.push(tag);picked.push(tag);
 }
 return {dict:next,picked,merged,added,skipped};
}

// 목록 화면 필터용: 글의 tags·keywords 에서 사전과 맞는 주제 태그 이름을 모두 구한다(예전 글의 긴 태그도 동의어로 맞춰 본다).
export function topicLabels(record,dict){
 return classify([...(record.tags||[]),...(record.keywords||[])],dict,{category:record.category||''}).topic.map(t=>t.label);
}

export function tagGroups(items,dict){
 const counts=new Map();
 for(const item of items)for(const label of item.topicTags||[])counts.set(label,(counts.get(label)||0)+1);
 const order=new Map(dict.groups.map((g,i)=>[g,i]));
 const groups=new Map();
 for(const tag of dict.tags){
  const count=counts.get(tag.label);if(!count)continue;
  const g=groups.get(tag.group)||[];g.push({label:tag.label,count});groups.set(tag.group,g);
 }
 return [...groups.entries()].sort((a,b)=>(order.get(a[0])??99)-(order.get(b[0])??99)).map(([group,tags])=>({group,tags:tags.sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ko'))}));
}

// 글 하나의 태그 계산. explicit(주제 태그를 직접 고른 경우, 예: AI 생성)가 있으면 그것이 기준이고,
// 없으면 입력 목록(해시태그 등)에서 사전과 맞는 것만 고른다. 2개 미만이면 입력 목록의 사전에 없는 말을 승격해 채운다.
export function computeTags({inputs=[],explicit=null,dict,category=''}){
 const {topic,candidates,keywords}=classify(inputs,dict,{category});
 let working=dict,picked=[],merged=[],added=[],skipped=[];
 const max=dict.rules.tagsPerPost.max,min=dict.rules.tagsPerPost.min;
 if(explicit&&explicit.length){
  const r=resolveUnknown(explicit,dict,{category});
  working=r.dict;picked=r.picked.filter(t=>inScope(t,category));merged=r.merged;added=r.added;skipped=r.skipped;
 }else{
  picked=[...topic];
  if(picked.length<min&&candidates.length){
   const r=resolveUnknown(candidates,dict,{maxNew:min-picked.length,category});
   working=r.dict;merged=r.merged;added=r.added;skipped=r.skipped;
   for(const t of r.picked)if(!picked.some(x=>x.id===t.id)&&inScope(t,category))picked.push(t);
  }
 }
 const tags=picked.slice(0,max).map(t=>t.label);
 return {tags,keywords:[...new Set([...keywords,...(explicit||[])])].slice(0,50),dict:working,merged,added,skipped,overflow:picked.slice(max).map(t=>t.label),changed:added.length>0||merged.length>0};
}
