# QRATOR 콘텐츠 스튜디오

등기가이드 HTML·ZIP을 팀이 함께 검토하는 작업 공간. HTML/CSS/JavaScript + Vercel Node.js Functions + 비공개 AWS S3 구성입니다. Supabase는 필요하지 않습니다.

## 기능

팀 공용 비밀번호 로그인, HTML·ZIP 가져오기, 화면/소스 편집, PC/모바일 미리보기, 필터·검색 결과 전체 선택, ZIP 내보내기, 저장 후 목록 이동, 수정 충돌 감지, 최근 20개 수정 이력 불러오기, 휴지통·복원.
게시 예정/전달 완료는 내부 관리 표시이며 큐레이터 홈페이지에 자동 발행하지 않습니다.

## 썸네일: 목록은 1:1, 상세는 16:9

한 글은 이미지를 두 가지로 가질 수 있습니다.

| 용도 | 비율 | 파일 이름 규칙 | 쓰이는 곳 |
| --- | --- | --- | --- |
| 대표 이미지 | 16:9 (1280×720 권장) | `assets/thumbnails/{slug}.svg\|png\|jpg\|webp` | 글 상세(본문 맨 위 커버) |
| 목록 썸네일 | 1:1 (720×720 권장) | `assets/thumbnails/{slug}-square.…` (이름 끝이 `-square`·`_square`·`-1x1`) | 콘텐츠 목록 |

- 목록은 항상 64px 정사각 타일입니다. `-square` 이미지가 있으면 그것을, 없으면 대표 이미지를 가운데 기준으로 잘라 보여 줍니다(가운데 정렬 커버는 그대로 잘 보이고, 왼쪽 정렬 16:9 커버는 1:1 이미지를 따로 올리면 됩니다).
- AI 콘텐츠 생성은 같은 제목 문구로 16:9와 1:1을 함께 만들어 저장합니다(`renderCoverSvg`, `renderSquareCoverSvg`).
- 글 편집 화면의 "썸네일"에서 두 이미지를 미리 보고(실제 크기·비율 확인, 비율이 다르면 안내), 각각 바꿀 수 있습니다. 대표 이미지를 바꾸면 본문의 `<img>` 경로도 함께 맞춰집니다.
- ZIP 가져오기는 본문이 가리키는 썸네일 옆의 `-square` 파일도 함께 가져옵니다. HTML만 가져와 이미지가 빠진 경우에는 가져오기 직후 어떤 파일이 빠졌는지 알려 줍니다.

## 이미지 API 주소 (썸네일 누락 방지)

HTML만 따로 옮기면 상대 경로(`./assets/thumbnails/…`) 이미지가 빠집니다. 그래서 글마다 로그인 없이 열리는 이미지 주소를 제공합니다.

`GET /api/thumbnail?slug={slug}&variant=cover|square&sig={서명}`

- 주소와 서명은 글 편집 화면의 "API 주소 복사"와 `GET /api/studio?op=get` 응답의 `imageLinks`에 있습니다. ZIP 내보내기의 `content.json`에도 들어갑니다.
- 서명은 글 주소+종류마다 달라 다른 글·다른 종류에 쓸 수 없고, 이미지를 바꿔도 주소는 그대로입니다(5분 이내 반영). 비공개 상태·휴지통의 글은 서명이 맞아도 열리지 않습니다.
- 목록·편집 화면의 "HTML 이미지를 API 주소로 연결"을 켜면 ZIP의 HTML에서 대표·목록 썸네일 `<img>`가 이 주소를 가리킵니다(이미지 파일도 ZIP에 함께 들어갑니다). 기본은 꺼짐입니다.
- 서명 키는 `THUMBNAIL_LINK_SECRET`(32자 이상, 선택)입니다. 없으면 `SESSION_SECRET`에서 만들어 쓰므로, `SESSION_SECRET`을 바꾸면 이미 내보낸 HTML의 이미지 주소가 무효가 됩니다. 오래 쓸 주소라면 `THUMBNAIL_LINK_SECRET`을 따로 설정하세요.
- 외부 도구가 글 등록 뒤 이미지를 따로 붙이는 `POST /api/content-thumbnail`(Bearer 키)은 이제 SVG뿐 아니라 PNG·JPG·WEBP와 `-square` 이미지도 받습니다. 본문이 같은 글의 다른 확장자 썸네일을 가리키고 있으면 새 파일 경로로 맞춰 줍니다. 파일 내용이 형식과 다르거나 SVG에 스크립트가 있으면 거부합니다.

## 네이버 게시 현황

사이드 메뉴 "네이버 게시 현황"은 네이버 블로그의 공개 RSS(`https://rss.blog.naver.com/{블로그ID}.xml`)를 읽어 실제로 올라가 있는 글(제목·발행 일시·분류·태그·썸네일·바로가기)을 보여 주고 스튜디오 글과 맞춰 봅니다. 로그인이나 API 키는 필요 없습니다.

- 연결 근거: ① 스튜디오 글의 "참고 자료"·메모에 네이버 글 주소(번호)가 있음 ② 메모에 네이버 제목이 적혀 있음 ③ 제목이 같음 ④ 제목이 매우 비슷함. 홈페이지 제목을 네이버 제목과 다르게 지었다면 "참고 자료"에 네이버 글 주소를 넣어 두면 정확히 연결됩니다.
- 네이버에 공개된 최근 글(약 30~40건)만 보입니다. 비공개·임시저장 글은 RSS에 나오지 않습니다.
- 같은 서버에서는 1분간 결과를 재사용하고, 새로고침도 10초에 한 번만 네이버에 요청합니다. 블로그 ID는 기본 `qrator_kr`이며 환경변수 `NAVER_BLOG_ID`로 바꿀 수 있습니다.
- 스튜디오에는 있지만(작성 완료·게시 예정·게시 완료·전달 완료) 네이버에서 찾지 못한 글은 별도로 모아 보여 줍니다.

## Vercel 연결

1. Vercel → Add New → Project → GitHub 연결.
2. Configure GitHub App에서 `ssohyun5360/qrator-content-studio` 접근 허용.
3. PR을 main에 병합한 뒤 해당 저장소를 Import.
4. Framework: Other / Root Directory: 저장소 루트 / Build: `npm run build` / Output: `public`. vercel.json에 포함되어 있습니다.
5. 배포 후 아래 환경변수를 설정하고 Redeploy. 설정 전에는 로그인 화면과 연결 설정 안내가 표시됩니다.
6. 회사 업무용 운영은 상업적 사용이 허용되는 Vercel 요금제를 선택합니다.

## AWS 준비

- S3 일반 버킷을 서울(ap-northeast-2) 리전에 만듭니다. 버킷 이름은 전 세계에서 고유해야 합니다.
- 모든 퍼블릭 액세스 차단, ACL 비활성화, 기본 SSE-S3 암호화를 유지합니다. 브라우저가 직접 S3에 접근하지 않아 CORS/공개 설정은 필요 없습니다.
- 앱 전용 IAM 자격 증명에 docs/aws-policy.json을 적용합니다. YOUR_BUCKET_NAME을 실제 이름으로 바꿉니다. 루트 키/관리자 권한 키는 사용하지 않습니다.
- 키는 Vercel 환경변수에 직접 입력합니다. 채팅/GitHub에 공유하지 않습니다. 추후 Vercel OIDC 단기 자격 증명으로 전환할 수 있습니다.
- 개발/미리보기와 운영은 버킷과 인증 값을 분리하세요.

## Vercel → Settings → Environment Variables

| 이름 | 값 |
| --- | --- |
| AWS_REGION | ap-northeast-2 |
| S3_BUCKET | 실제 버킷 이름 |
| AWS_ACCESS_KEY_ID | 앱 전용 IAM 액세스 키 |
| AWS_SECRET_ACCESS_KEY | 해당 시크릿 키 |
| STUDIO_PASSWORD | 무작위 팀 비밀번호, 16자 이상 |
| SESSION_SECRET | 별도 무작위 세션 서명 문자열, 32자 이상 |
| APP_ORIGIN | 실제 사이트 주소, 예: https://내사이트.vercel.app |
| CONTENT_UPLOAD_TOKEN | 외부 콘텐츠 등록 전용 무작위 키, 32자 이상 |

설정 후 Redeploy합니다. 시크릿 변수에 NEXT_PUBLIC_/VITE_ 접두사를 붙이지 않습니다. APP_ORIGIN과 다른 도메인의 변경 요청은 차단됩니다. 커스텀 도메인으로 변경하면 값을 수정하고 재배포합니다.

## 인증과 요청 흐름

브라우저 → 같은 출처 /api/studio → 세션·권한 검사 → S3.
비밀번호는 환경변수에만 보관하고 해시 기반 상수 시간 비교로 검사합니다. 세션 쿠키는 HMAC 서명, HttpOnly/Secure/SameSite=Strict, 유효기간 12시간입니다. 비밀번호나 SESSION_SECRET 변경 시 기존 세션도 무효화됩니다.
로그인은 IP당 15분 최대 10회로 S3에서 제한합니다. Vercel 제공 IP를 사용하며 같은 IP인 팀원은 제한을 공유할 수 있습니다. 변경 POST는 Origin을 확인합니다. 로그인 없이 목록/본문/이력을 읽을 수 없습니다.
팀 공용 계정은 모두 같은 편집 권한입니다. 작성자 입력은 본인 인증된 감사 기록이 아닙니다. 개별 권한은 별도 사용자 인증이 필요합니다.
외부 작성 도구는 `POST /api/content-upload`에 `Authorization: Bearer {CONTENT_UPLOAD_TOKEN}` 헤더와 콘텐츠 JSON을 보내 새 글만 등록할 수 있습니다. 서버는 게시 상태를 `작성 중`, 검토 상태를 `검토 전`으로 고정하며 기존 글 수정·삭제·복구는 허용하지 않습니다. `POST /api/content-thumbnail`은 같은 키로 기존 글에 지정된 썸네일 파일만 추가·교체하며, 본문과 상태는 변경하지 않습니다.
S3의 studio/records/{slug}.json에 HTML·base64 첨부·메타데이터, studio/versions/에 이전 버전, studio/auth/에 로그인 시도 횟수를 보관합니다. revision과 ETag 조건부 쓰기로 오래된 편집본의 덮어쓰기를 막습니다. 휴지통은 deletedAt 표시만 바꿉니다.
미리보기는 스크립트가 차단된 sandbox iframe입니다. 외부 이미지/스타일/폰트는 원본 링크로 로드될 수 있습니다.

## 첫 버전의 한계

- 글 한 편의 HTML+첨부를 JSON으로 보낸 크기 3MB 이하. base64 때문에 실제 파일보다 큽니다. 대용량 이미지·동영상 업로드용은 아닙니다.
- HTML 2MB, ZIP 압축 15MB/해제 합계 40MB/300개 파일 이하. ZIP의 각 글에도 전송 3MB 제한이 적용됩니다. 묶음 ZIP의 첨부는 각 글에 포함되므로 큰 묶음은 글별로 나누세요.
- 목록은 현재 글들을 S3에서 읽는 소규모 팀용 구조입니다. 글 수/크기가 늘면 별도 인덱스나 DB를 추가합니다.
- UI는 최근 20개 이력을 제공하지만 이전 버전 파일은 S3에서 자동 삭제하지 않습니다. 휴지통도 영구 삭제하지 않습니다. 보관 용량과 요청·트래픽에 따른 AWS 비용, Vercel 요금은 별도입니다.
- API 테스트는 메모리로 대체한 AWS 응답을 사용합니다. 실제 AWS/Vercel 연동 검증은 계정 설정 후 필요합니다.

## 개발

npm ci / npm test / npm run build.
npm run dev는 localhost:3000에서 설정 전 화면 확인용입니다. 인증 테스트에는 Secure 쿠키 때문에 HTTPS가 필요합니다.

## 참고 구현

사용자 지정 https://qrator-content-studio.vercel.app/ 의 공개 프런트엔드(index.html, styles.css, app.mjs, client-helpers.mjs)를 기반으로 수정했습니다. 비공개 서버 코드나 콘텐츠 데이터는 가져오지 않았습니다. API·AWS 저장·인증은 신규 구현입니다. JSZip의 라이선스 고지가 포함된 npm 배포 파일을 빌드 시 복사합니다.
