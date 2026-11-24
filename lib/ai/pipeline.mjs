import {fail} from '../core.mjs';
import {loadJob,saveJob} from './jobs.mjs';

export const STEP_NAMES=['topic','dup_check','outline','sections','assemble','check_fix','template','thumbnail','save'];
export const MAX_STEP_ATTEMPTS=5;
export const LEASE_MS=90_000;
export const STEP_BUDGET_MS=50_000;

export function sanitizeError(e){
 const raw=String(e?.message||e||'알 수 없는 오류');
 return raw
  .replace(/sk-[A-Za-z0-9_-]{8,}/g,'[키]')
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi,'Bearer [키]')
  .replace(/\s+/g,' ').slice(0,300);
}

// 브라우저에는 단계별 산출물(outputs)을 내려주지 않는다. 다만 저장 단계가 끝나면 어떤 글이 만들어졌는지(slug·제목)는
// result 로 알려 준다. 대시보드가 "목록에서 확인" 때 그 글로 바로 이동하는 데 쓴다.
export function publicJob(job){
 const {outputs,...rest}=job;
 const saved=outputs?.save;
 const result=rest.result||(saved&&typeof saved.slug==='string'?{slug:saved.slug,title:String(saved.title||''),revision:saved.revision??null}:null);
 return {...rest,result,outputKeys:Object.keys(outputs||{})};
}

// 한 번 호출에 한 단계만 실행한다. 중간에 끊겨도 같은 작업을 다시 호출하면 그 단계부터 이어진다.
export async function advanceJob(id,{runners,now=()=>Date.now()}){
 const first=await loadJob(id);
 let job=first.value;
 if(job.status==='done')return job;
 if(job.status==='failed')fail(409,'실패한 작업입니다. 다시 시도를 눌러 주세요.');
 const step=job.steps.find(s=>s.status!=='done');
 if(!step){job.status='done';await saveJob(job,first.etag);return job;}
 if(step.status==='running'&&Date.parse(step.leaseUntil)>now())return job;
 if(step.attempts>=MAX_STEP_ATTEMPTS){
  step.status='failed';step.error='재시도 횟수를 초과했습니다.';step.leaseUntil=null;job.status='failed';
  await saveJob(job,first.etag);return job;
 }
 const runner=runners[step.name];
 if(typeof runner!=='function')fail(500,'작업 단계 설정이 올바르지 않습니다.');
 step.status='running';step.attempts+=1;step.error=null;
 step.startedAt=new Date(now()).toISOString();
 step.leaseUntil=new Date(now()+LEASE_MS).toISOString();
 job.status='in_progress';
 await saveJob(job,first.etag);

 let output=null,error=null;
 try{output=await runner({job:structuredClone(job),stepName:step.name,deadline:now()+STEP_BUDGET_MS});}
 catch(e){error=sanitizeError(e);}

 const latest=await loadJob(id);
 job=latest.value;
 const current=job.steps.find(s=>s.name===step.name);
 if(!current||current.status!=='running'||current.attempts!==step.attempts)return job;
 current.leaseUntil=null;current.finishedAt=new Date(now()).toISOString();
 if(error){current.status='failed';current.error=error;job.status='failed';}
 else{
  current.status='done';job.outputs[step.name]=output??null;
  job.status=job.steps.every(s=>s.status==='done')?'done':'in_progress';
 }
 await saveJob(job,latest.etag);
 return job;
}

export async function retryJob(id){
 const {value:job,etag}=await loadJob(id);
 if(job.status!=='failed')fail(409,'실패한 작업만 다시 시도할 수 있습니다.');
 const step=job.steps.find(s=>s.status==='failed');
 if(!step||step.attempts>=MAX_STEP_ATTEMPTS)fail(409,'재시도 횟수를 초과했습니다. 새 작업으로 다시 생성해 주세요.');
 step.status='pending';step.error=null;job.status='in_progress';
 await saveJob(job,etag);
 return job;
}
