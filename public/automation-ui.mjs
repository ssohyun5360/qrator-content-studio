const $=id=>document.getElementById(id);
const main=document.querySelector('main');

const today=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date());
const tomorrow=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',weekday:'short'}).format(new Date(Date.now()+86400000));

main.insertAdjacentHTML('beforeend',`
<section id="automationDashboard" class="automation-view" hidden>
  <div class="auto-page-head"><div><div class="auto-title-row"><h1>콘텐츠 대시보드</h1><span class="auto-version">v1.0 · 정리안</span></div><p>자동 생성된 원고와 오류를 확인할 수 있습니다.</p></div><time>${today}</time></div>
  <div class="auto-next"><strong>다음 실행</strong><span>${tomorrow} 09:30</span><span>네이버 임시저장 · 1건 · 임원 사임·퇴임 등기</span><button type="button" data-auto-nav="settings">생성 설정 →</button></div>
  <section class="auto-panel auto-today">
    <div class="auto-section-head"><h2>오늘의 원고</h2><span class="auto-badge warning">임시저장 완료 · 발행 대기</span></div>
    <div class="auto-draft-grid">
      <div class="auto-thumb"><span>등기 가이드</span><strong>법인 본점 이전<br>등기 후 할 일</strong><i></i></div>
      <div class="auto-draft-copy"><h3>법인 본점 이전했다면? 등기 후 꼭 해야 할 일 총정리</h3><p>본점 이전 · 약 3,300자 · 태그 15개 · 네이버 임시저장 09:37</p><small>발행 전 확인이 필요한 항목을 누르면 자세히 볼 수 있습니다.</small>
        <div class="auto-check-cards"><button type="button" data-review="template"><b>✓</b><span>템플릿 일치<strong>99.3% · 목표 99%</strong></span><em>›</em></button><button type="button" data-review="image"><b>✓</b><span>대표 이미지<strong>1:1 · 신뢰 블루</strong></span><em>›</em></button><button type="button" class="needs-check" data-review="evidence"><b>!</b><span>근거 확인<strong>사람 확인 2문장</strong></span><em>›</em></button></div>
      </div>
      <div class="auto-draft-action"><button type="button" class="dark" data-review="template">원고 점검하기</button><p>검토 완료 후 발행할 수 있습니다.</p></div>
    </div>
  </section>
  <div class="auto-two-col">
    <section class="auto-panel"><div class="auto-section-head"><h2>처리할 일</h2><span>오류·점검이 필요할 때만 표시</span></div><div class="auto-task"><i class="dot"></i><div><strong>법령 사이트 접속 지연</strong><p>law.go.kr 응답 없음 · 30분 뒤 자동 재확인 (2/3회)</p></div><span>자동 재시도 중</span><button type="button" data-demo-action="retry">지금 재확인</button></div><p class="auto-empty-note">그 밖에 처리할 일이 없습니다.</p></section>
    <section class="auto-panel auto-waiting"><div class="auto-section-head"><h2>발행 대기</h2><span>네이버 임시저장 상태</span></div><div class="auto-wait-count"><strong>3건</strong><span>확인 필요 2건</span></div><p>11.15 · 11.16 · 11.17</p><button type="button" data-auto-nav="contents">발행 대기 글 보기</button></section>
  </div>
  <section class="auto-panel"><div class="auto-section-head"><h2>카테고리별 게시 분포</h2><span>게시 완료 30건 기준</span><button type="button" data-auto-nav="settings">카테고리 관리 →</button></div><div class="auto-distribution"><div><header><b>등기 가이드</b><strong>20건 · 67%</strong></header><div class="auto-bar"><i style="width:67%"></i></div><p>목표 60% · 상호 3 · 본점 6 · 임원 6 · 목적 3 · 지점 2</p></div><div><header><b class="purple">인사이트</b><strong>7건 · 23%</strong></header><div class="auto-bar purple"><i style="width:23%"></i></div><p>목표 25% · 세법·제도 변화 5 · 판례·해석 2</p></div><div><header><b class="red">실무 워크북</b><strong>3건 · 10%</strong></header><div class="auto-bar red"><i style="width:10%"></i></div><p>목표 15% · 서류 발급·열람 2 · 체크리스트 1</p></div></div></section>
</section>

<section id="automationSettings" class="automation-view" hidden>
  <div class="auto-page-head"><div><div class="auto-title-row"><h1>생성 설정</h1><span class="auto-version">v1.0 · 정리안</span></div><p>자동 생성 규칙을 관리합니다. 바꾼 항목만 눌러서 수정하세요.</p></div><span>다음 생성 ${tomorrow} 08:45 · 1건</span></div>
  <form id="automationSettingsForm" class="auto-settings">
    <details open><summary><span>실행 일정</span><strong>매일 1건 · 공휴일 중단 · 날짜 예외 2개</strong><small>원고 생성 08:45 → 네이버 입력 09:30</small></summary><div class="auto-settings-body"><div class="auto-field"><label>반복 일정</label><div class="auto-day-row"><span>매일</span><b>월</b><b>화</b><b>수</b><b>목</b><b>금</b><i>토</i><i>일</i><input type="number" min="1" max="10" value="1" aria-label="하루 생성 건수"><span>건</span><label class="auto-switch"><input type="checkbox" checked><i></i></label></div></div><div class="auto-field"><label>실행 시각</label><input type="time" value="08:45"><span>→ 네이버 입력</span><input type="time" value="09:30"><label class="auto-check"><input type="checkbox" checked> 원고가 늦게 끝나면 완성 즉시 입력</label></div><div class="auto-field"><label>날짜 예외</label><span class="auto-chip">11.20 (금) · 2건 ×</span><span class="auto-chip">11.27 (금) · 생성 안 함 ×</span><button type="button" data-demo-action="date">+ 날짜 추가</button></div></div></details>
    <details><summary><span>카테고리 · 주제</span><strong>카테고리 3개 · 주제 9개 중 8개 사용</strong><small>등기가이드 60% · 인사이트 25% · 실무 워크북 15%</small></summary><div class="auto-settings-body"><div class="auto-category-row"><b>등기 가이드</b><div><span class="auto-chip">상호 변경</span><span class="auto-chip">본점 이전</span><span class="auto-chip">임원 변경</span><span class="auto-chip">목적 변경</span><span class="auto-chip muted">지점 변경 · 중지</span></div><select aria-label="등기 가이드 생성 비중"><option>60%</option></select><label class="auto-switch"><input type="checkbox" checked><i></i></label><button type="button" data-demo-action="edit">편집</button></div><div class="auto-category-row"><b class="purple">인사이트</b><div><span class="auto-chip">세법·제도 변화</span><span class="auto-chip">판례·해석</span></div><select aria-label="인사이트 생성 비중"><option>25%</option></select><label class="auto-switch"><input type="checkbox" checked><i></i></label><button type="button" data-demo-action="edit">편집</button></div><div class="auto-category-row"><b class="red">실무 워크북</b><div><span class="auto-chip">서류 발급·열람</span><span class="auto-chip">체크리스트</span></div><select aria-label="실무 워크북 생성 비중"><option>15%</option></select><label class="auto-switch"><input type="checkbox" checked><i></i></label><button type="button" data-demo-action="edit">편집</button></div></div></details>
    <details><summary><span>참고 사이트</span><strong>2개 · 인터넷등기소, 국가법령정보센터</strong><small>소재·근거 확인용</small></summary><div class="auto-settings-body"><div class="auto-field"><label>등록 사이트</label><input class="auto-wide" value="https://www.iros.go.kr" aria-label="참고 사이트 1"><input class="auto-wide" value="https://www.law.go.kr" aria-label="참고 사이트 2"></div></div></details>
    <details><summary><span>템플릿 일치 점검</span><strong>켜짐 · 목표 99% · 원고 생성 직후 1회</strong><small>최근 평균 6개 · 최근 11.17 일치 99.3%</small></summary><div class="auto-settings-body"><div class="auto-field"><label>검사 기준</label><input type="number" min="0" max="100" value="99"><span>% 이상</span><label class="auto-switch"><input type="checkbox" checked><i></i></label></div></div></details>
    <details><summary><span>발행</span><strong>사람이 확인 후 발행</strong><small>자동 발행 꺼짐 · 2~4주 운영 후 전환 검토</small></summary><div class="auto-settings-body"><div class="auto-field"><label>최종 승인</label><label class="auto-check"><input type="checkbox" checked> 검토 완료 전에는 발행 버튼 잠금</label></div></div></details>
    <details><summary><span>작성 규칙</span><strong>6개 항목 · AI 지시문 직접 수정</strong><small>글 구조 · 문장 · 서식 · 고정 문구 · 제목·태그 · 근거·검증</small></summary><div class="auto-settings-body"><textarea rows="7" class="auto-wide">글 구조와 문체, 고정 문구, 제목·태그, 근거 검증 규칙을 적용합니다.\n서비스가 제공하지 않는 기능을 제공한다고 표현하지 않습니다.\n법령·기한·결의 요건은 공식 자료에서 확인합니다.</textarea></div></details>
  </form>
  <div class="auto-settings-actions"><span>저장하면 바꾼 항목과 적용 시점을 확인하는 창이 먼저 열립니다.</span><button type="button" id="automationHistoryButton">변경 이력</button><button type="button" class="primary" id="automationSaveButton" disabled>변경 사항 저장</button></div>
</section>

<section id="automationRuns" class="automation-view" hidden>
  <div class="auto-page-head"><div><div class="auto-title-row"><h1>실행 기록</h1><span class="auto-version">v1.0 · 현행 기능 기준</span></div><p>콘텐츠 관리 › 실행 기록 › 2026. 11. 17 · 본점 이전 등기 후 할 일</p></div></div>
  <div class="auto-run-head"><button type="button" data-auto-nav="dashboard">← 목록으로</button><span class="auto-badge success">임시저장 완료</span><div></div><button type="button" data-demo-action="source">원고 보기</button><button type="button" disabled>네이버 임시저장 열기</button><button type="button" class="primary" data-demo-action="rerun">다시 실행</button></div>
  <div class="auto-run-grid"><section class="auto-panel"><div class="auto-section-head"><h2>실행 단계</h2><span>2026. 11. 17 (화) · 자동 실행 로그</span></div><ol class="auto-timeline"><li class="done"><time>08:45</time><div><strong>주제 선정</strong><p>대기열 1순위 ‘본점 이전 등기 후 할 일’ 사용</p></div><span>완료</span></li><li class="done"><time>08:46</time><div><strong>원고 생성</strong><p>작성일 반영 · 법령·문장 재검토 · 원문 미확인 3건</p></div><span>완료</span></li><li class="done"><time>08:49</time><div><strong>서식 검사</strong><p>PASS 42 · WARN 0 · FAIL 0</p></div><span>통과</span></li><li class="done"><time>08:49</time><div><strong>대표 이미지</strong><p>1:1 1080px · 2줄 등기 후 할 일 · 한계 960px</p></div><span>완료</span></li><li class="fail"><time>09:30</time><div><strong>네이버 입력 1/3</strong><p>첫 문단 붙여넣기가 반영되지 않아 중단</p></div><span>실패</span></li><li class="done"><time>09:33</time><div><strong>네이버 입력 2/3</strong><p>25블록 입력 · 블록 순서·소제목·정렬 검사 통과</p></div><span>성공</span></li><li class="done"><time>09:37</time><div><strong>임시저장</strong><p>네이버 임시저장함 5 → 6건</p></div><span>완료</span></li><li><time>—</time><div><strong>검토·발행</strong><p>사람이 카테고리·태그 입력 후 발행</p></div><span>대기</span></li></ol></section><aside><section class="auto-panel auto-result"><h2>검사 결과</h2><p>자동 검사 · 입력 후 재검사</p><div><b>PASS<strong>42</strong></b><b>WARN<strong>0</strong></b><b>FAIL<strong>0</strong></b></div></section><section class="auto-panel"><div class="auto-section-head"><h2>사람 검토 필요</h2><span class="auto-badge danger">3건</span></div><ul class="auto-review-list"><li>상법 제182조 · 본점 이전 등기 기한 원문 미확인</li><li>4대보험 기관별 기한 원문 미확인</li><li>고용·산재보험 시행규칙 문구 원문 미확인</li></ul></section><section class="auto-panel"><h2>발행 전 사람이 할 일</h2><label class="auto-check"><input type="checkbox"> 카테고리 ‘등기가이드’ 선택</label><label class="auto-check"><input type="checkbox"> 태그 15개 입력</label><label class="auto-check"><input type="checkbox"> 사람 검토 필요 항목 확인</label><label class="auto-check"><input type="checkbox"> 네이버에서 발행</label></section></aside></div>
  <section class="auto-artifacts"><strong>산출물</strong><span>naver_blocks.json</span><span>네이버 원고.md</span><span>네이버 대표이미지 1x1.png</span><span>사람검토목록.md</span><span>검사결과.txt</span></section>
</section>

<dialog id="automationReviewDialog" class="auto-review-dialog"><div class="auto-review-head"><div><h2>원고 점검</h2><p>법인 본점 이전했다면? 등기 후 꼭 해야 할 일 총정리</p></div><button type="button" id="closeAutomationReview" aria-label="닫기">×</button></div><div class="auto-review-layout"><nav><button class="active" type="button" data-review-tab="template"><b>✓</b> 템플릿 일치 <span>99.3%</span></button><button type="button" data-review-tab="image"><b>✓</b> 대표 이미지 <span>통과</span></button><button type="button" data-review-tab="evidence"><b>!</b> 근거 확인 <span id="evidenceCount">2문장</span></button></nav><div class="auto-review-content" id="reviewTemplate"><h3>템플릿 일치</h3><p>기존 네이버 블로그 글 20건과 서식·구조를 비교한 결과입니다.</p><div class="auto-score"><strong>99.3%</strong><span><b>목표 99% 달성</b>생성 직후 자동 수정 1회</span></div>${['글 구조','표','FAQ','고정 문구','서식','분량'].map((x,i)=>`<div class="auto-score-row"><span>${x}</span><i><b style="width:${i===5?'96':'100'}%"></b></i><strong>${i===5?'96':'100'}%</strong></div>`).join('')}</div><div class="auto-review-content" id="reviewImage" hidden><h3>대표 이미지</h3><p>비율, 문구 길이와 컬러 규칙을 확인했습니다.</p><div class="auto-image-preview"><span>등기 가이드</span><strong>본점 이전 등기<br>등기 후 할 일</strong><i></i></div><ul class="auto-simple-list"><li>1:1 비율 · 1080 × 1080px</li><li>신뢰 블루 컬러 사용</li><li>2줄 제목 영역 안전 범위 통과</li></ul></div><div class="auto-review-content" id="reviewEvidence" hidden><h3>근거 확인</h3><p>법령 원문을 확인하지 못한 문장입니다. 확인한 뒤 처리 상태를 선택하세요.</p><div class="auto-evidence" data-evidence-item><q>관할 밖으로 본점을 옮기면 구 본점과 신 본점 소재지 등기소에 모두 신청해야 합니다.</q><span>근거 조문 링크가 연결되지 않음</span><div><button type="button" data-demo-action="source">원문 열기 ↗</button><button type="button" data-evidence-action="revision">수정 필요</button><button type="button" class="dark" data-evidence-action="confirm">확인함</button></div></div><div class="auto-evidence" data-evidence-item><q>기한을 넘겨 신청하면 과태료가 부과될 수 있습니다.</q><span>근거 조문 원문 재확인 필요</span><div><button type="button" data-demo-action="source">원문 열기 ↗</button><button type="button" data-evidence-action="revision">수정 필요</button><button type="button" class="dark" data-evidence-action="confirm">확인함</button></div></div></div></div><div class="auto-review-foot"><span id="reviewProgress">사람 확인 0/2 · 모두 처리하면 발행하기가 열립니다.</span><button type="button" id="reviewCloseBottom">닫기</button><button type="button" class="primary" id="reviewPublish" disabled>발행하기</button></div></dialog>
`);

const views={dashboard:$('automationDashboard'),settings:$('automationSettings'),runs:$('automationRuns')};
const navs={dashboard:$('navDashboard'),settings:$('navSettings'),runs:$('navRuns'),contents:$('navContents')};

function canLeaveEditor(){
  if($('editorView').hidden)return true;
  const label=$('saveState').textContent;
  return !/변경|임시 저장/.test(label)||confirm('저장하지 않은 변경사항이 있습니다. 다른 화면으로 이동하시겠습니까?');
}
function activateNav(name){document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));navs[name]?.classList.add('active');}
function showAutomation(name){if(!canLeaveEditor())return;[$('listView'),$('editorView'),...Object.values(views)].forEach(v=>v.hidden=true);views[name].hidden=false;activateNav(name);window.scrollTo({top:0,behavior:'instant'});}
navs.dashboard.onclick=()=>showAutomation('dashboard');
navs.settings.onclick=()=>showAutomation('settings');
navs.runs.onclick=()=>showAutomation('runs');
document.addEventListener('qrator:view',e=>{if(e.detail==='contents'){Object.values(views).forEach(v=>v.hidden=true);activateNav('contents');}});

document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-auto-nav]');
  if(nav){const target=nav.dataset.autoNav;if(target==='contents')navs.contents.click();else showAutomation(target);return;}
  const review=e.target.closest('[data-review]');if(review){openReview(review.dataset.review);return;}
  const action=e.target.closest('[data-demo-action]');if(action){showAutomationToast(action.dataset.demoAction);}
});

function showAutomationToast(action){const messages={retry:'재확인 상태로 변경했습니다. 실제 자동 실행은 다음 단계에서 연결됩니다.',rerun:'다시 실행 요청 화면까지 구현되었습니다. 자동 생성은 다음 단계에서 연결됩니다.',source:'원문 연결은 자동화 단계에서 적용됩니다.',date:'날짜 예외 입력 UI는 다음 세부 설정에서 연결됩니다.',edit:'주제 편집 UI는 다음 세부 설정에서 연결됩니다.'};let toast=$('automationToast');if(!toast){toast=document.createElement('div');toast.id='automationToast';document.body.append(toast);}toast.textContent=messages[action]||'화면 기능을 확인했습니다.';toast.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>toast.hidden=true,2600);}

const reviewDialog=$('automationReviewDialog');
function openReview(tab='template'){if(!reviewDialog.open)reviewDialog.showModal();selectReviewTab(tab);}
function selectReviewTab(tab){reviewDialog.querySelectorAll('[data-review-tab]').forEach(x=>x.classList.toggle('active',x.dataset.reviewTab===tab));$('reviewTemplate').hidden=tab!=='template';$('reviewImage').hidden=tab!=='image';$('reviewEvidence').hidden=tab!=='evidence';}
reviewDialog.querySelectorAll('[data-review-tab]').forEach(x=>x.onclick=()=>selectReviewTab(x.dataset.reviewTab));
$('closeAutomationReview').onclick=$('reviewCloseBottom').onclick=()=>reviewDialog.close();
let evidenceDone=0;
reviewDialog.addEventListener('click',e=>{const button=e.target.closest('[data-evidence-action]');if(!button)return;const item=button.closest('[data-evidence-item]');if(item.dataset.done)return;item.dataset.done=button.dataset.evidenceAction;item.classList.add(button.dataset.evidenceAction==='confirm'?'confirmed':'revision');item.querySelectorAll('[data-evidence-action]').forEach(x=>x.disabled=true);evidenceDone++;$('evidenceCount').textContent=(2-evidenceDone)+'문장';$('reviewProgress').textContent=evidenceDone<2?`사람 확인 ${evidenceDone}/2 · 모두 처리하면 발행하기가 열립니다.`:'사람 확인 2/2 · 발행 준비가 완료되었습니다.';$('reviewPublish').disabled=evidenceDone<2;});
$('reviewPublish').onclick=()=>{reviewDialog.close();showAutomationToast('publish');};

const settingsForm=$('automationSettingsForm');
settingsForm.addEventListener('input',()=>{$('automationSaveButton').disabled=false;});
$('automationSaveButton').onclick=()=>{localStorage.setItem('qrator-automation-settings-v1',JSON.stringify({savedAt:new Date().toISOString(),enabled:true}));$('automationSaveButton').disabled=true;showAutomationToast('saved');};
$('automationHistoryButton').onclick=()=>showAutomationToast('history');

