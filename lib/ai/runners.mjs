import {fail,nextRecord} from '../core.mjs';
import {read,write,list} from '../storage.mjs';
import {checkArticle,summarizeChecks,RULE_VERSION} from './checks.mjs';
import {renderHomeArticleDetailed,homeAssets} from './template-home.mjs';
import lawDb from './rules/v1/laws.json' with {type:'json'};
import {renderCoverSvg,renderSquareCoverSvg} from './thumbnail.mjs';
import {mockArticle} from './mock-article.mjs';
import {loadFormat} from '../format-store.mjs';
import {normalizeRecordTags} from '../tags-store.mjs';

const VERIFICATION='AI 생성 초안 · 관리자 검토 전';

// ---- 제목 유사도(중복 주제 검사): 두 글자 조각의 겹침 비율 ----
const normalize=s=>String(s||'').toLowerCase().replace(/[^0-9a-z가-힣]/g,'');
function bigrams(text){const n=normalize(text),set=new Set();for(let i=0;i<n.length-1;i++)set.add(n.slice(i,i+2));return set;}
export function similarity(a,b){
 const A=bigrams(a),B=bigrams(b);
 if(!A.size||!B.size)return 0;
 let hit=0;for(const x of A)if(B.has(x))hit++;
 return hit/(A.size+B.size-hit);
}

async function existing(){
 const records=await list();
 return {records,titles:records.map(r=>r.title),slugs:records.map(r=>r.slug)};
}

function articleOf(job){
 const article=job.outputs?.assemble?.article;
 if(!article)throw new Error('앞 단계의 원고가 없습니다.');
 return article;
}

// ---- 실제 코드로 동작하는 단계 ----
const dupCheck=async({job})=>{
 const {records}=await existing();
 const topic=job.outputs?.topic?.topic||job.input?.topic||'';
 const similar=records.filter(r=>!r.deletedAt).map(r=>({slug:r.slug,title:r.title,score:Number(similarity(topic,r.title).toFixed(2))}))
  .filter(x=>x.score>=0.4).sort((a,b)=>b.score-a.score).slice(0,3);
 return {topic,existingCount:records.length,similar};
};

const checkFix=async({job})=>{
 const article=articleOf(job);
 const mock=!!job.meta?.mock;
 const ex=await existing();
 const result=checkArticle(article,{today:new Date(),lawFacts:Object.values(lawDb.entries).map(e=>({key:e.key,verified:e.verified})),existingTitles:mock?null:ex.titles,existingSlugs:ex.slugs});
 if(result.fail.length)throw new Error('검사 실패: '+result.fail.map(f=>f.id).join(', '));
 return {summary:summarizeChecks(result),warn:result.warn.map(w=>({id:w.id,label:w.label})),ruleVersion:RULE_VERSION};
};

const template=async({job})=>{
 const article=articleOf(job);
 const ex=await existing();
 const slug=(article.slugCandidates||[]).find(s=>!ex.slugs.includes(s));
 if(!slug)throw new Error('사용할 수 있는 상세 주소 후보가 없습니다.');
 const fmt=await loadFormat();
 const {html,needsCheck}=renderHomeArticleDetailed(article,{date:new Date(),slug,coverPath:`assets/thumbnails/${slug}.svg`,format:fmt.values,laws:lawDb.entries});
 return {slug,html,needsCheck,formatVersion:fmt.version};
};

// 같은 제목 문구로 상세용 16:9 와 목록용 1:1 을 함께 만든다.
const thumbnail=async({job})=>{const lines=articleOf(job).thumbnail||{};return {svg:await renderCoverSvg(lines),squareSvg:await renderSquareCoverSvg(lines)};};

function noteOf(job,article,needsCheck,formatVersion){
 const lines=['AI 생성 초안 · 규칙 '+RULE_VERSION+' · 서식 v'+(formatVersion||0)+' · 작업 '+job.id,''];
 const human=(article.reviewNotes||[]).filter(n=>n.status==='needs_human');
 if(human.length||needsCheck.length){
  lines.push('[사람 검토 필요]');
  for(const n of human)lines.push('- '+n.text);
  for(const key of needsCheck)lines.push('- 법령 링크 확인 필요: '+(lawDb.entries[key]?.cite||key));
 }
 return lines.join('\n').slice(0,9800);
}

const save=async({job})=>{
 const article=articleOf(job);
 const {slug,html,needsCheck}=job.outputs.template;
 const svg=job.outputs.thumbnail.svg,squareSvg=job.outputs.thumbnail.squareSvg;
 const mock=!!job.meta?.mock;
 const record={
  slug,title:(mock?'[테스트] ':'')+article.title,category:article.category,contentType:job.input?.contentType||'guide',summary:article.summary,
  author:'클로드 자동화',verification:VERIFICATION,seoTitle:article.seoTitle,seoDescription:article.seoDescription,
  html,entryPath:'index.html',
  assets:[{path:`assets/thumbnails/${slug}.svg`,mime:'image/svg+xml',base64:Buffer.from(svg).toString('base64')},...(squareSvg?[{path:`assets/thumbnails/${slug}-square.svg`,mime:'image/svg+xml',base64:Buffer.from(squareSvg).toString('base64')}]:[]),...homeAssets()],
  tags:article.tags||[],sourceUrls:[],status:'draft',reviewStatus:'pending',note:noteOf(job,article,needsCheck||[],job.outputs.template.formatVersion),
  generatedBy:'ai',automationStatus:'review_pending',ruleVersion:RULE_VERSION,jobId:job.id,
  generatedAt:new Date().toISOString(),aiReview:job.outputs.check_fix.summary
 };
 // article.tags 는 해시태그(검색 키워드)다. 주제 태그는 AI가 topicTags 로 직접 고르면 그것을, 없으면 해시태그에서 사전과 맞는 것을 쓴다.
 try{const t=await normalizeRecordTags(record,{explicit:Array.isArray(article.topicTags)&&article.topicTags.length?article.topicTags:null});record.tags=t.tags;record.keywords=t.keywords;}
 catch(e){console.error('Tag normalize failed',e.name);record.keywords=[...(record.tags||[])];record.tags=[];}
 const next=nextRecord(record,null,null);
 const key='studio/records/'+slug+'.json';
 if(await read(key))fail(409,'같은 상세 주소의 글이 이미 있습니다.');
 await write(key,next);
 return {slug,title:next.title,revision:next.revision};
};

export function pipelineRunners(content){
 return {topic:content.topic,dup_check:dupCheck,outline:content.outline,sections:content.sections,assemble:content.assemble,
  check_fix:checkFix,template,thumbnail,save};
}

// ---- 1~3단계: AI 없이 흐름만 확인하는 가짜 원고 ----
export function mockContent(){
 return {
  topic:async({job})=>({topic:job.input?.topic||mockArticle().title,brief:job.input?.brief||'',planning:job.input?.planning||{},source:'mock'}),
  outline:async()=>({mock:true}),
  sections:async()=>({mock:true}),
  assemble:async()=>{
   const article=mockArticle();
   article.slugCandidates=['mock-sample-'+Date.now().toString(36)];
   return {article,source:'mock'};
  }
 };
}

export function mockRunners(){return pipelineRunners(mockContent());}

// 주제 선정·목차·섹션 작성·합치기 단계는 AI 연결(4단계) 때 content 자리에 들어간다.
export function getRunners(env){
 if(env.AI_MOCK==='1')return mockRunners();
 fail(503,'실제 AI 생성 단계는 아직 준비 중입니다.');
}
