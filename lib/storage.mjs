import {S3Client,GetObjectCommand,PutObjectCommand,ListObjectsV2Command,DeleteObjectCommand,DeleteObjectsCommand} from '@aws-sdk/client-s3';
const client=new S3Client({region:process.env.AWS_REGION});
export async function read(key){try {const r=await client.send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));return {value:JSON.parse(await r.Body.transformToString()),etag:r.ETag};}catch(e){if(e.name==='NoSuchKey'||e.$metadata?.httpStatusCode===404)return null;throw e;}}
export async function write(key,value,etag){return client.send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:JSON.stringify(value),ContentType:'application/json',ServerSideEncryption:'AES256',...(etag?{IfMatch:etag}:{IfNoneMatch:'*'})}));}
export async function list(){let token;const keys=[];do{const page=await client.send(new ListObjectsV2Command({Bucket:process.env.S3_BUCKET,Prefix:'studio/records/',ContinuationToken:token}));keys.push(...(page.Contents||[]).map(x=>x.Key));token=page.NextContinuationToken;}while(token);const result=[];for(let i=0;i<keys.length;i+=10){const chunk=await Promise.all(keys.slice(i,i+10).map(read));result.push(...chunk.filter(Boolean).map(x=>x.value));}return result;}

export async function remove(key){return client.send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));}
export async function removePrefix(prefix){
 let token;
 do{
  const page=await client.send(new ListObjectsV2Command({Bucket:process.env.S3_BUCKET,Prefix:prefix,ContinuationToken:token}));
  const keys=(page.Contents||[]).map(x=>({Key:x.Key}));
  for(let i=0;i<keys.length;i+=1000){
   const result=await client.send(new DeleteObjectsCommand({Bucket:process.env.S3_BUCKET,Delete:{Objects:keys.slice(i,i+1000),Quiet:true}}));
   if(result.Errors?.length)throw new Error('Some archived content could not be deleted.');
  }
  token=page.NextContinuationToken;
 }while(token);
}
