// 생성 설정 화면의 '홈페이지 글 서식' 묶음: 정렬·글꼴 크기·간격을 서버에 저장한다.
const $=id=>document.getElementById(id);
const section=$('automationSettings');
const anchor=section?.querySelector('.auto-settings-actions');
if(section&&anchor){
 const ALIGN_FIELDS=[['titleAlign','제목'],['headingAlign','소제목'],['bodyAlign','본문'],['boxAlign','요약·목차 박스']];
 const NUM_FIELDS=[['titleSize','제목 글자 크기','px'],['headingSize','소제목 글자 크기','px'],['bodySize','본문 글자 크기','px'],['lineHeight','본문 줄 간격','배'],['paragraphGap','문단 간격','px'],['sectionGap','소제목 구간 간격','px']];
 const state={meta:null,saved:null,busy:false,loaded:false};

 const wrap=document.createElement('div');
 wrap.className='auto-settings fmt-settings';wrap.id='formatSettings';
 wrap.innerHTML=`<details open><summary><span>홈페이지 글 서식</span><strong id="fmtSummary">불러오는 중…</strong><small id="fmtVersion"></small></summary>
 <div class="auto-settings-body fmt-body">
  <p class="fmt-note">AI가 만드는 홈페이지 글과 자동화 글에 적용됩니다. 목록·표·FAQ·안내 박스 안의 글은 읽기 편하도록 항상 왼쪽 정렬입니다. 저장하면 <b>다음 생성부터</b> 적용되고, 이미 만든 글은 바뀌지 않습니다.</p>
  <div class="fmt-presets" id="fmtPresets"></div>
  <div class="fmt-grid">
   <div class="fmt-col"><h3>정렬</h3>${ALIGN_FIELDS.map(([k,l])=>`<label class="fmt-row"><span>${l}</span><select id="fmt_${k}"><option value="left">왼쪽</option><option value="center">가운데</option></select></label>`).join('')}</div>
   <div class="fmt-col"><h3>글꼴 크기·간격</h3>${NUM_FIELDS.map(([k,l,u])=>`<label class="fmt-row"><span>${l}</span><span class="fmt-num"><input type="number" id="fmt_${k}" inputmode="decimal"><em>${u}</em></span><small id="fmtRange_${k}"></small></label>`).join('')}</div>
  </div>
  <div class="fmt-preview-wrap"><div class="fmt-preview-label">미리보기 <small>(데스크톱 화면 기준)</small></div>
   <div class="fmt-preview" id="fmtPreview"><div class="fmt-p-title">법인 영문 상호 바꾸려면? 상호 변경 등기 전 표기 규칙 정리</div><div class="fmt-p-h2">1. 영문 상호만으로는 등기할 수 없어요</div><div class="fmt-p-body">상업등기규칙은 한글과 아라비아숫자를 쓰도록 정하고 있어요.<br>그래서 영문 이름만으로 상호를 등기할 수는 없어요.</div></div></div>
  <div class="fmt-actions"><span id="fmtStatus" role="status" aria-live="polite"></span><button type="button" id="fmtRevert" disabled>되돌리기</button><button type="button" class="primary" id="fmtSave" disabled>서식 저장</button></div>
  <ul class="fmt-history" id="fmtHistory"></ul>
 </div></details>`;
 anchor.insertAdjacentElement('afterend',wrap);

 const status=(text,kind='',sticky=false)=>{const el=$('fmtStatus');el.textContent=text;el.className=kind;state.sticky=sticky;};
 const api=async(op,body)=>{
  const response=await fetch('/api/format-settings?op='+op,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'요청에 실패했습니다.');
  return data;
 };
 const read=()=>{
  const v={};
  for(const [k] of ALIGN_FIELDS)v[k]=$('fmt_'+k).value;
  for(const [k] of NUM_FIELDS)v[k]=$('fmt_'+k).value.trim()===''?NaN:Number($('fmt_'+k).value);
  return v;
 };
 const write=v=>{
  for(const [k] of ALIGN_FIELDS)$('fmt_'+k).value=v[k];
  for(const [k] of NUM_FIELDS)$('fmt_'+k).value=String(v[k]);
 };
 const problems=v=>{
  const out=[];
  for(const [k,l] of NUM_FIELDS){const {min,max}=state.meta.limits[k];if(!Number.isFinite(v[k])||v[k]<min||v[k]>max)out.push(`${l}은(는) ${min}~${max} 사이로 입력해 주세요.`);}
  return out;
 };
 const same=(a,b)=>[...ALIGN_FIELDS,...NUM_FIELDS].every(([k])=>a[k]===b[k]);
 const alignWord=a=>a==='center'?'가운데':'왼쪽';
 const preview=v=>{
  const ok=problems(v).length===0;
  if(!ok)return;
  const p=$('fmtPreview'),t=p.querySelector('.fmt-p-title'),h=p.querySelector('.fmt-p-h2'),b=p.querySelector('.fmt-p-body');
  t.style.cssText=`text-align:${v.titleAlign};font-size:${v.titleSize}px`;
  h.style.cssText=`text-align:${v.headingAlign};font-size:${v.headingSize}px;margin-top:${v.sectionGap}px`;
  b.style.cssText=`text-align:${v.bodyAlign};font-size:${v.bodySize}px;line-height:${v.lineHeight};margin-top:${v.paragraphGap}px`;
 };
 const refresh=()=>{
  if(!state.saved)return;
  const v=read(),errs=problems(v),dirty=!same(v,state.saved.values);
  $('fmtSave').disabled=state.busy||!dirty||errs.length>0;
  $('fmtRevert').disabled=state.busy||!dirty;
  preview(v);
  if(errs.length)status(errs[0],'fmt-error');
  else if(state.sticky)return;
  else if(dirty)status('저장하지 않은 변경이 있어요.');
  else status('');
 };
 const render=data=>{
  state.saved=data;
  write(data.values);
  const v=data.values;
  $('fmtSummary').textContent=`제목 ${alignWord(v.titleAlign)} · 소제목 ${alignWord(v.headingAlign)} · 본문 ${alignWord(v.bodyAlign)} · 본문 ${v.bodySize}px`;
  $('fmtVersion').textContent=data.version?`v${data.version}`:'기본값';
  $('fmtHistory').innerHTML='';
  for(const h of data.history||[]){
   const li=document.createElement('li');
   const when=h.updatedAt?new Date(h.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
   li.textContent=`v${h.version} · ${when} · ${h.preset&&state.meta.presets[h.preset]?state.meta.presets[h.preset].label+' 적용':(h.changed||[]).join(', ')}`;
   $('fmtHistory').append(li);
  }
  refresh();
 };
 const setLimits=()=>{
  for(const [k] of NUM_FIELDS){
   const {min,max,step}=state.meta.limits[k],el=$('fmt_'+k);
   el.min=min;el.max=max;el.step=step;
   $('fmtRange_'+k).textContent=`${min}~${max}`;
  }
  const box=$('fmtPresets');box.innerHTML='<span>한 번에 적용:</span>';
  for(const [key,p] of Object.entries(state.meta.presets)){
   const btn=document.createElement('button');btn.type='button';btn.textContent=p.label;btn.dataset.preset=key;
   btn.onclick=()=>applyPreset(key,p.label);
   box.append(btn);
  }
 };
 const load=async()=>{
  try{
   status('');
   const data=await api('get');
   state.meta=data;if(!state.loaded){setLimits();state.loaded=true;}
   render(data);
  }catch(e){
   $('fmtSummary').textContent='불러오지 못했어요';
   status(e.message,'fmt-error');
  }
 };
 const finish=(data,done)=>{
  render(data);
  if(data.unchanged){status('바뀐 내용이 없어요.','',true);return;}
  const m=data.mirror||{};
  status(m.ok?`${done} 이 PC 자동화에도 전달했어요.`:`${done} 단, 이 PC 자동화 전달은 못 했어요: ${m.reason||'알 수 없는 이유'}`,m.ok?'fmt-ok':'fmt-warn',true);
 };
 const run=async(task)=>{
  state.busy=true;state.sticky=false;refresh();status('저장하는 중…');
  try{await task();}
  catch(e){if(/먼저 저장/.test(e.message))await load();status(e.message,'fmt-error',true);}
  finally{state.busy=false;refresh();}
 };
 const applyPreset=(key,label)=>{
  if(!confirm(`'${label}' 서식으로 바꿀까요? 지금 입력한 값은 바뀌고, 바로 저장됩니다.`))return;
  run(async()=>finish(await api('reset',{preset:key,expectedVersion:state.saved.version}),`'${label}'을(를) 저장했어요.`));
 };
 $('fmtSave').onclick=()=>run(async()=>finish(await api('save',{values:read(),expectedVersion:state.saved.version}),'저장했어요. 다음 생성부터 적용돼요.'));
 $('fmtRevert').onclick=()=>{write(state.saved.values);status('');refresh();};
 wrap.addEventListener('input',e=>{if(e.target.matches('select,input')){state.sticky=false;refresh();}});
 wrap.addEventListener('change',e=>{if(e.target.matches('select,input')){state.sticky=false;refresh();}});

 new MutationObserver(()=>{if(!section.hidden)load();}).observe(section,{attributes:true,attributeFilter:['hidden']});
 if(!section.hidden)load();
}
