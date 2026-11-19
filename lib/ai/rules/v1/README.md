# AI 생성 규칙 v1 (ruleVersion: `v1`)

관리자만 이 저장소에서 수정한다. 사용자가 화면에서 바꿀 수 없다. 값을 바꾸면 `ruleVersion`(`fixed.json`·`banned.json`)을 올리고, 생성된 글에는 그 버전이 `ruleVersion` 필드로 남는다.

## 파일
| 파일 | 내용 |
|---|---|
| `fixed.json` | 기준값(`limits`), 카테고리·썸네일 1줄 목록, 팁 접두어, 면책 문구 템플릿(`{{DATE_TXT}}`), 네이버 CTA·링크카드 고정문, 모델이 쓰면 안 되는 고정 문구, 사실 확인 대상 패턴 |
| `banned.json` | 금지어, 운영사 이름, 붙여쓰기 금지, 과장 표현(fail/warn), 서비스 범위 위반(fail/warn), 합니다체 어미 |
| `../../checks.mjs` | 위 파일을 읽어 원고를 검사하는 코드 (`checkArticle`, `summarizeChecks`, `feedbackFor`, `canAutoFix`) |

과장 표현·서비스 범위 목록은 기존 문서에 구체 목록이 없어 v1에서 **초안으로 새로 정했다**. 사용자 검토 후 조정한다.

## 검사 결과 형식
`checkArticle(article, {today, lawFacts, existingTitles, existingSlugs})` → `{pass, warn, fail}`, 각 항목 `{id, label, detail}`.
- `fail`: 저장 전에 고쳐야 함(자동 수정 대상, 최대 `limits.maxAutoFix`=3회)
- `warn`: 저장은 하되 사람이 확인(화면의 "확인 필요")
- `lawFacts`(법령 근거 사전의 `{key, verified}` 배열), `existingTitles`, `existingSlugs`는 서버가 줄 때만 해당 검사를 한다.
- `article.disclaimer` / `article.cta` / `article.oglinkUrl`은 서버가 고정문을 삽입한 결과를 넘길 때만 고정본과 비교한다.
- 날짜는 한국 시간 기준 `YYYY. M. D.`(월·일 앞 0 없음).

## 검사 ID
| 구분 | ID (수준) |
|---|---|
| 메타·길이 | `schema.object`(F) `meta.required`(F) `length.title`(W) `meta.studio-limits`(F) `meta.category`(F) `meta.slug`(F) `meta.slug-free`(F) `meta.tags`(F) `meta.thumbnail`(F) `meta.thumbnail-width`(W) |
| 구조 | `structure.sections-count`(F) `structure.h2-number`(F) `structure.h2-question`(W) `structure.section-parts`(F) `structure.intro-count`(F) `structure.conclusion`(F) `structure.three-line`(F) `structure.closing`(W) `structure.tables-min`(F) `structure.tables-spread`(W) `structure.table-shape`(F) `structure.faq-count`(F) `structure.faq-answer-start`(W) `structure.tips-count`(F) `structure.tips-prefix`(F) `structure.checks-min`(W) `structure.source-refs`(F) `structure.bridge`(W) |
| 분량·서식 | `length.chars`(W) `length.paragraph`(W) `style.bold-count`(W) `style.allowed-tags`(F) `style.emoji`(W) |
| 표기·문체 | `style.forbidden-words`(F) `style.curly-quotes`(F) `style.spacing`(F) `style.hapnida`(F) `style.exaggeration`(F) `style.exaggeration-review`(W) `style.service-scope`(F) `style.service-scope-review`(W) `style.founding-mention`(W) |
| 고정문 | `fixed.no-model-fixed-text`(F) `fixed.disclaimer`(F) `fixed.cta`(F) `fixed.oglink`(F) |
| 중복·근거·검토 | `dup.title`(F/W) `review.status`(F) `review.notes`(W) `law.refs-exist`(F) `law.used-keys`(W) `law.needs-human`(F) `law.human-confirm`(W) `fact.sentences`(W) |

## 아직 이 모듈에서 하지 않는 검사
- 네이버 전용(블록 순서·구분선·"안녕하세요" 첫 줄·참고 줄·밑줄 횟수·"해 주세요")은 2차 네이버 변환 단계에서 다룬다.
- 렌더링된 홈페이지 HTML의 구조·크기 검사(세 줄 요약·목차·promo·이용 안내 존재, html 2MB·레코드 3MB·assets 300개)는 템플릿 모듈 결과물에 대해 별도로 한다.
- 기한·금액이 근거 사전 값과 같은지의 자동 대조(N5)는 설계가 정해질 때까지 `fact.sentences` 경고로 사람에게 넘긴다.
