import {randomBytes} from 'node:crypto';
import {read,write,listPrefix} from '../storage.mjs';
import {fail} from '../core.mjs';

export const JOB_PREFIX='studio/jobs/';
const ID_PATTERN=/^\d{14}-[0-9a-f]{8}$/;

export function jobId(value){
 if(typeof value!=='string'||!ID_PATTERN.test(value))fail(400,'작업 번호가 올바르지 않습니다.');
 return value;
}

const keyOf=id=>JOB_PREFIX+jobId(id)+'.json';

export function newJob({stepNames,input,meta={},now=new Date()}){
 const iso=now.toISOString();
 return {
  id:iso.replace(/\D/g,'').slice(0,14)+'-'+randomBytes(4).toString('hex'),
  status:'pending',createdAt:iso,updatedAt:iso,input,meta,
  steps:stepNames.map(name=>({name,status:'pending',attempts:0,error:null,startedAt:null,finishedAt:null,leaseUntil:null})),
  outputs:{},result:null
 };
}

export async function createJob(job){await write(keyOf(job.id),job);return job;}

export async function loadJob(id){
 const found=await read(keyOf(id));
 if(!found)fail(404,'작업을 찾을 수 없습니다.');
 return found;
}

export async function saveJob(job,etag){
 job.updatedAt=new Date().toISOString();
 await write(keyOf(job.id),job,etag);
}

export async function recentJobs(limit=20){
 const keys=(await listPrefix(JOB_PREFIX))
  .filter(k=>ID_PATTERN.test(k.slice(JOB_PREFIX.length,-'.json'.length)))
  .sort().reverse().slice(0,limit);
 const found=await Promise.all(keys.map(k=>read(k)));
 return found.filter(Boolean).map(f=>f.value);
}
