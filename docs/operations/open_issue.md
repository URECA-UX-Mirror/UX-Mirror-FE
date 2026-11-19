# 미결정 항목

계약서에 없거나 정해지지 않은 항목이다. 프론트는 각 항목의 `임시 결정`으로 작업을 계속하고, 확정되면 해당 계약 문서를 고친 뒤 이 문서에서 항목을 지운다. 값이 달라지면 Adapter에서 흡수한다([프론트엔드 구조](../architecture/frontend-structure.md)).

| 역할 | 담당 |
| --- | --- |
| 에이전트 코어: 브라우저 | 이성집 |
| 에이전트 코어: 흐름·저장 | 정자비 |
| 실행 API (페르소나·목표 입력) | 장근창 |
| UX 분석·비교 | 정윤희 |
| 프론트엔드 | 권혁준 |

## 요약

| ID | 항목 | 담당 | 임시 결정 | 2번 답변 (11-18) |
| --- | --- | --- | --- | --- |
| [OI-3](#oi-3) | 도착 화면 스크린샷 조회 | 정자비, 장근창 | 별도 API `GET /api/runs/{runId}/screenshots/goal`로 표시, 없으면 "도착 화면 이미지 없음" | 구현됨, 실제 서버 연동 확인 대기(UX-Mirror-BE #56 머지됨) |
| [OI-8](#oi-8) | 분석 대상 사이트 입력 | 장근창 | 입력란은 두되 요청에 싣지 않고, MORO MARKET 외 값은 안내 후 시작을 막음; 등록 사이트 선택은 [OI-11](#oi-11), 임의 URL은 미해결 | (장근창 담당) |
| [OI-7](#oi-7) | 저장된 실측 데이터 시연 | 정자비 | `/replay`에서 원본 `LIVE` Run을 조회해 재생, 서버 없는 시연은 P0 제외 | 임시 결정대로. 고정 키는 E 실행 키 4개로 반영 |
| [OI-9](#oi-9) | 목표·사용자 유형 직접 입력 | 정자비, 장근창 | 백엔드 구현 기준으로 요청·표시, 도착 화면은 목록에서 고름 | 화면 글자 사전 검사(`422`·`503`)는 BE #60으로 구현됨. 도착 경로 없음 `422`·지도 오류 처리도 구현됨 |
| [OI-10](#oi-10) | 경로 지표 기준(basis)·우회 이동 | 정자비, 장근창 | 설계 v2.1 기준으로 optional로 받고, 설정의 `basis`가 없으면 `ALLOWED_PATHS`, 설정이 없으면 기준 없음으로 읽음 | 서버 동작과 대조 완료 |
| [OI-11](#oi-11) | 시나리오 테스트(외부 사이트) | 장근창, 정자비, 권혁준 | 등록 사이트 선택, mock과 Adapter로 선행 | API 세부 사항 확정 대기 |
| [OI-12](#oi-12) | UX Optimizer 응답 형식·이유 코드 | 정윤희, 장근창, 권혁준 | BE 코드·README 기준으로 DTO·mock 선행, 이유 코드는 원문 문자열로 받음 | 계약 v1.3.8 반영(#43)과 정책 모듈 값 목록 확정 대기 |
| [OI-13](#oi-13) | 자동 개선 결과(`improvement.json`) 형식 | 정자비, 권혁준 | 팀이 확정한 샘플을 정본으로 정적 JSON을 영역별로 검증, 모르는 enum은 원문 | 통합 후 정자비가 계약서에 반영 |

## 항목

<a id="oi-3"></a>
### OI-3 도착 화면 스크린샷 조회

- 계약서: 목표 화면에 도착만 하고 모델 판단을 하지 않은 화면은 Step이 없고(`§15.3`), 스크린샷 API는 `stepId` 기준이다(`§17.7`).
- 경로의 마지막 노드(환불 신청 화면)의 이미지를 가져올 방법이 없다. 백엔드 실행 API는 이 항목을 범위에서 제외했다.
- 임시 결정: 별도 endpoint로 도착 화면 이미지를 표시하고, 없으면 "도착 화면 이미지 없음"을 표시한다. 구현됨, 실제 서버 연동 확인 대기.
- 확인할 것: 도착 화면 이미지를 저장할지, 저장한다면 `PathVisit`에 참조를 둘지 별도 endpoint를 둘지. 저장 구조(정자비)가 정해진 뒤 결정하고, API는 별도 endpoint 또는 기존 스크린샷 API 확장으로 제공될 예정이다.
- 2번 답변 (11-18): **별도 endpoint로 결정.**
  - 저장: 이미 저장 중이다. 도착 시 루프가 사진을 찍어 `GOAL_REACHED` Event의 `details.screenshotRef`에 기록한다. 파일은 `screenshots/{마지막 stepId + 1}.png`라 `stepId` 스크린샷 API로는 `404`다. `PathVisit`은 바꾸지 않는다.
  - API: `GET /api/runs/{runId}/screenshots/goal` → `image/png`. 도착하지 않았거나 사진이 없으면 `404 RUN_NOT_FOUND` (UX-Mirror-BE #56, 11-18 머지됨).
  - FE: `terminationReason`이 `GOAL_VERIFIED`인 Run만 호출하고, `404`면 지금처럼 "도착 화면 이미지 없음"을 표시한다.
  - 남은 것: 실제 서버 연동 확인(환불·버전 비교·시나리오 Run) 뒤 이 항목 삭제, 계약 v1.3.7 반영.
- 담당: 정자비(저장), 장근창(API).

<a id="oi-7"></a>
### OI-7 저장된 실측 데이터 시연

- 계약서: `SAVED_MEASURED`는 과거 실제 호출 결과를 저장한 뒤 재생한 결과다(`§2.1`).
- 백엔드 결정: P0에서는 `SAVED_MEASURED` Run을 만들지 않는다. 시연은 원본 `LIVE` Run을 기존 조회 API(`GET /api/runs`, `/api/runs/{runId}`, `/steps`, `/screenshots`, `/api/comparisons/{experimentKey}`)로 읽기만 해서 재생한다. 새 API는 없고 원본 데이터의 `resultOrigin`은 `LIVE` 그대로다. 복사본이 필요하면 별도 `runId`·`experimentKey`로 복사하고 복사본만 `SAVED_MEASURED`로 저장한다.
- 시연 Run 고정: 백엔드 `results/final_execution_plan.json`의 `experimentKey`로 고정한다(제안). 재생 중 `LIVE` 실행은 다른 `experimentKey`로만 하며, 같은 키에 `VALID` Run이 있으면 `409 EXPERIMENT_RUN_EXISTS`로 원본이 보호된다.
- 임시 결정: 재생 모드는 `/replay`에서 고정 `experimentKey`의 Run 목록을 읽어 기존 화면으로 연결한다. 고정 키는 `src/features/replay/constants.ts`의 `REPLAY_EXPERIMENTS`(여러 키 목록)이며 E 실행 최종 실행 계획 `final-plan-1119`의 `replay`와 같은 `e-s1-1119`(환불)·`e-s2-1119`(배송)·`e-s3-1119`(쿠폰)·`e-s4-1119`(문의)다. mock 모드에서는 첫 키만 시드가 있다. 서버 없는 시연(정적 결과 파일 읽기)은 P0에서 하지 않는다. 기획안이 복잡한 리플레이를 P0 밖에 두고 이 요구를 찾지 못했기 때문이다.
- 확인할 것: "서버가 꺼져도 시연 가능"(역할 분담 5번 완료 기준)을 P0에 넣을지는 기획 확인 후 최종 결정한다.
- 2번 답변 (11-18): **임시 결정대로 한다.** 원본 `LIVE` Run을 기존 조회 API로 재생하고 `SAVED_MEASURED` 복사본은 만들지 않는다. 서버 없는 시연은 P0에서 제외한다. 고정 키는 11/19 E 실행 후 `results/final_execution_plan.json`의 `experimentKey`를 전달하며, 상수 교체는 #34에서 한다.
- 담당: 정자비.

<a id="oi-8"></a>
### OI-8 분석 대상 사이트 입력

- 계약서: `POST /api/runs` 요청 본문은 `experimentKey`, `variant`, `goalId`, `personaId`, `maxSteps`다. 사이트(주소)를 받는 필드는 없고 대상은 `variant`에 따라 백엔드가 정한다.
- 임시 결정: 새 UX 분석 화면의 "분석 사이트"를 입력할 수 있게 두되 값은 요청에 싣지 않는다. 입력값이 MORO MARKET(대소문자·앞뒤 공백 무시)이 아니거나 비어 있으면 안내를 보이고 분석 시작을 막는다. 입력한 대상과 실제 분석 대상이 달라지지 않게 하기 위해서다.
- 부분 해결: 등록된 외부 사이트 선택 방안으로 범위상 부분 해결했다. API 확정과 구현은 [OI-11](#oi-11)에서 진행 중이며 임의 URL 입력은 미해결이다.
- 확인할 것: 임의 사이트를 분석할지, 요청 필드(예: 사이트 주소·버전별 주소)와 검증 규칙을 어떻게 둘지. 확정되면 계약서를 고치고 입력값을 요청에 싣는다.
- 담당: 장근창(API).

<a id="oi-9"></a>
### OI-9 목표·사용자 유형 직접 입력

- 상태: 백엔드 구현은 끝났다(UX-Mirror-BE #39·#42·#44). 요청·응답·비교 동작은 [REST API](../contracts/rest-api.md)와 [데이터 모델](../contracts/data-model.md)로 옮겼고, 이 항목에는 계약서에 아직 반영되지 않은 부분만 남긴다.
- 계약서(v1.3.5): `POST /api/runs`는 `goalId`·`personaId`만 받는다(`§5.1`, `§17.2`). 직접 입력 필드, Run `verification`, 비교 조건 변경은 계약 v1.3.6(초안)에 있다.
- 임시 결정: 프론트는 백엔드 구현 기준으로 요청을 보내고 표시한다. 직접 입력 목표의 사이트 지도 기준은 [OI-10](#oi-10)을 따른다. 성공 조건의 도착 화면은 화면에서 목록으로 고르고, 실제 화면의 글자 검사는 서버가 실행 전에 한다.
- 실행 전 화면 글자 검사(UX-Mirror-BE #60 머지): 직접 입력한 목표만 검사하며, 요청의 `variant`와 관계없이 Before·After 두 쇼핑몰을 모두 연다(After 실행 요청에도 Before 화면 오류가 올 수 있다). 도착 화면이 쇼핑몰에 없거나 다른 화면으로 이동하거나 글자가 없으면 `422 CONTRACT_VALIDATION_ERROR`, 화면을 열지 못하거나 화면마다 10초(요청당 최대 약 20초) 안에 응답이 없으면 재시도 가능한 `503 BROWSER_ERROR`이며 두 경우 모두 Run을 만들지 않는다. 완성된 지도에서 도착 경로가 없을 때 `422`를 반환하는 검사도 백엔드에 반영됐다. 지도 오류 처리는 [OI-10](#oi-10)을 따른다.
- 확인할 것: 계약 v1.3.6이 확정되면 `docs/contracts/`를 고친다. 계약서에 아직 반영되지 않은 위 검사의 오류 코드·메시지는 계약 확정 뒤 [#43](https://github.com/UX-Mirror/UX-Mirror-FE/issues/43)에서 처리하며, 미결정 사항이 모두 해소되면 이 항목을 지운다.
- 2번 답변 (11-18): 화면을 열어 글자를 확인하는 사전 검사(`422`·`503 BROWSER_ERROR`)는 BE #60 머지로 구현됐다. 그 전에 구현된 것은 두 가지다.
  - 지도는 정상인데 시작 화면에서 도착 화면으로 가는 경로가 없으면 `422 CONTRACT_VALIDATION_ERROR`, Run을 만들지 않는다.
  - 지도 오류(파일 없음·검증 실패·조건 불일치·도착 화면이 지도에 없음)면 실행은 하고 `referencePathConfig: null`로 저장한다.
  - FE: 성공 조건 도착 화면은 지금처럼 목록에서 고른다.
- 담당: 정자비(루프), 장근창(API).

<a id="oi-10"></a>
### OI-10 경로 지표 기준(basis)·우회 이동

- 계약서(v1.3.5): `referencePathConfig`는 허용 경로(`allowedPaths`·`shortestAllowedSteps`)만 정의하고 `basis`·`detourMoveCount`는 없다.
- 임시 결정: 설계 v2.1에 따라 `referencePathConfig.basis`와 `summary.detourMoveCount`(비교 결과의 Run 단위 값 포함)를 optional로 받는다. 백엔드 develop에는 사이트 지도 저장과 루프 집계가 반영됐다(UX-Mirror-BE #49·#50). 계약 v1.3.7은 미확정이며 FE는 값을 계산하지 않고 서버 값만 표시한다. 아래 표는 문제와 처리를 항목별로 적고, 협의로 확정되면 `docs/contracts/`를 고친 뒤 그 행을 지운다.

| 문제 | 처리(임시) | 근거 | 백엔드와 확인할 것 | 서버 동작 (develop, 11-18 2번 답변) |
| --- | --- | --- | --- | --- |
| `detourMoveCount`가 없을 때의 값 | `null`로 읽고 0으로 바꾸지 않는다 | 근거 없음, 임시 | 허용 경로 기준 Run에서도 필드를 주는지, `null`을 주는지 | 일치. ALLOWED_PATHS·기준 없음 Run은 필드를 주고 값은 `null`. UX-Mirror-BE #52 이전 Run은 필드가 없다 |
| 목표 미도달(`MAX_STEPS` 등) Run의 `detourMoveCount` | mock은 이동 기록으로 계산한다. 정의에 목표 도달 여부가 없고 `extraSteps`와 달리 최단 경로 비교가 필요 없기 때문이다 | 설계 3.1(미도달 정책은 근거 없음) | 미도달이면 `null`인지, 이동 기록으로 계산하는지 | 일치. 지도 밖으로 나가지 않았으면 도달 여부와 무관하게 이동 기록으로 계산 |
| SITE_MAP 설정 필드 | `siteMapVersion`·`siteMapHash`·`startPageKey`·`goalPageKey`·`shortestSteps`·`distances`(도달 불가 화면은 `null`)로 읽고 화면에는 쓰지 않는다 | 설계 4.1 | 실제 응답의 필드명·`null` 표현 | 일치. `basis: "SITE_MAP"` + 왼쪽 필드, `distances`의 도달 불가 화면은 `null` |
| SITE_MAP 기준의 `referencePathDeviationCount` | 이탈 횟수는 허용 경로 개념이라 mock은 `null`로 둔다 | 근거 없음, 임시 | 서버가 `null`을 주는지, 다른 정의를 쓰는지 | 일치. SITE_MAP·기준 없음이면 `null` |
| SITE_MAP 추가 단계 지표 | 설계상 `extraSteps`·`extraNavigationCost`·`attemptedExtraSteps`는 지도상 최단 거리 기준이며 계산 불가 시 `null`이다. 지도 밖 화면으로 이동하면 `extraSteps`와 `detourMoveCount`는 `null`이다 | 설계 3.2·4.2 | 서버와 비교 응답 `RunOutcome`의 계산·null 조건 및 기준별 표시 방식 | 일치. 세 지표는 도착 + 지도 안일 때만 값. 지도 밖 이동 시 세 지표와 `detourMoveCount` 모두 `null`. 비교 `runComparison`도 지도 검증 실패 시 `extraSteps`·`extraNavigationCost`·`referencePathDeviationCount`·`detourMoveCount`를 `null`로 |
| 지도 오류 | 설계상 지도 없음·검증 실패·Run 조건 불일치 시 실행은 허용하고 `referencePathConfig`와 경로 지표는 `null`이다 | 설계 3.2 | 서버의 지도 오류 처리 및 응답 형식 | 일치. 단, 지도는 정상인데 도착 경로가 없으면 실행 전 `422` ([OI-9](#oi-9)) |
| 직접 입력한 목표의 SITE_MAP 적용 | 백엔드가 직접 입력 목표에 SITE_MAP 설정을 저장하며 mock도 `goalId`가 `null`이어도 SITE_MAP을 유지한다 | UX-Mirror-BE #50 | 실제 Run 통합 결과와 계약 확정 | UX-Mirror-BE #51 머지. 실서버 확인: 직접 입력 Run(MORO MARKET)의 기준이 `SITE_MAP`으로 저장되고 결과 화면에 "사이트 지도"로 표시됨 |
| 결과 화면의 `null` 기준 구분 | `referenceBasis`가 `null`이면 원인(허용 경로 없음·지도 오류)을 응답에서 알 수 없어 "계산 불가 (경로 기준 없음)"으로만 표시하고 `goalId` 등으로 추정하지 않는다 | 근거 없음, 임시 | 응답에 기준 없음의 원인을 구분하는 값을 줄지 | 원인 값은 주지 않는다. P0는 "계산 불가 (경로 기준 없음)" 하나로 유지 |
| 우회 이동의 정의 | BACK을 뺀 모델 CLICK 이동 중 `d(이동 후) >= d(이동 전)`인 횟수로 mock을 만든다 | 설계 3.1 | 서버 계산과 일치하는지 | 일치. `null` 거리는 무한대로 보고, 지도 밖 CLICK이 있으면 `null`이다 |

- 2번 답변 (11-18): 서버 Run에는 `referenceBasis` 필드가 없고 FE Adapter가 `referencePathConfig`에서 만든다.
- 확인할 것: FE는 경로 기준을 `Run.referenceBasis`로 구분한다. 백엔드와 기준별 응답·표시 및 사이트 지도 생성·검증, 지원 화면 범위를 확인한다. 사이트 지도 변경은 계약 v1.3.7 제안이며, 위 항목은 실제 연동과 계약 확정 후 `docs/contracts/`와 mock에 반영하고 해당 행을 지운다. 모두 해소되면 이 항목을 지운다.
- 담당: 정자비(지표), 장근창(API).

<a id="oi-11"></a>
### OI-11 시나리오 테스트(외부 사이트)

- 범위: 서버에 등록된 사이트만 선택한다. 임의 URL을 이용한 범용 분석은 [OI-8](#oi-8)에 남긴다. MORO MARKET 버전 비교는 기존 방식을 유지한다.
- 계약서 v1.3.5에 없는 항목: Run 요청의 `siteId`, `GET /api/sites`, 시나리오 Run의 `variant`와 구분 값 `mode`, 사이트 이름과 화면 목록 필드.
- 확정(계약서 미반영): 시나리오 Run은 `variant: before`와 `mode: SCENARIO`를 사용한다. `GET /api/sites` 응답과 Run의 `siteId`·`mode`는 장근창 님 답변을 기준으로 정한 mock 형식이다. 프론트는 mock과 Adapter로 먼저 만들었고, [UX-Mirror-BE #75](https://github.com/UX-Mirror/UX-Mirror-BE/pull/75) 머지 뒤 실서버와 대조했다. `GET /api/sites`와 Run 상세·목록의 `siteId`·`mode`는 이 mock 형식과 일치했고 DTO·Adapter·mock 수정은 필요 없었다.
- 임시 mock 형식([FE #53](https://github.com/UX-Mirror/UX-Mirror-FE/issues/53)): `GET /api/sites`는 `{items: [{siteId, name, mode, startPage, pages: [{pageKey, path, label, goalText, goalSelectable}], siteMap: {available}}]}` 형식이다. `goalText`는 `null`일 수 있다. `POST /api/runs`는 `siteId`를 선택적으로 받으며, Run 상세와 목록 항목은 `siteId`·`mode`를 선택적으로 받는다. 기존 버전 비교 Run의 두 필드는 `null`이거나 없을 수 있다. 상세 형식과 mock 처리 규칙은 FE #53을 따른다.
- BE #75의 안(머지됨): 사이트 목록에는 시나리오 사이트만 포함하고 MORO MARKET은 제외한다. 사이트 이름은 Run이 아닌 `GET /api/sites`의 `name`으로 찾는다. 시나리오 Run만 있는 실험의 비교 요청은 `404 RUN_NOT_FOUND`, 등록되지 않은 `siteId`와 MORO MARKET의 `siteId`는 `422 CONTRACT_VALIDATION_ERROR`다. 같은 `experimentKey`에 버전 비교 Run과 시나리오 Run을 섞으면 `422`이고, 시나리오 사전 검사 실패 메시지에는 Before/After를 붙이지 않는다. 실서버로 대조하지 못한 것은 시나리오 `experimentKey`의 비교 `404`와 `siteId`·`experimentKey` 혼용 `422`이다.
- BE #75의 안(머지됨)은 도착 화면 선택 가능 여부를 `pages[].goalSelectable`로 제공한다. 확인 글자가 있고 시작 화면이 아니며 지도에서 도달할 수 있는 화면을 선택할 수 있다. 지도가 없으면 도달 가능성은 검사하지 않는다. 추가 진단 필드 `pages[].goalUnavailableReason`(`START_PAGE`, `NO_GOAL_TEXT`, `UNREACHABLE_ON_SITE_MAP`)과 `siteMap.siteMapVersion`·`siteMap.unreachablePages`도 포함한다. FE mock은 이 필드를 모두 받으며 시연 사이트(`cafe24-ons`) 값은 BE `config/sites/cafe24-ons.json`과 지도 파일(UX-Mirror-BE #71)과 같다. mock의 시연 사이트는 `siteMap.available: true`(Run은 `SITE_MAP` 기준), 지도 없는 사이트는 `false`(Run은 `referencePathConfig: null`)다. 지도 거리·최단 클릭 수는 mock이 같은 지도에서 계산한 근사값이다.
- 영어 목표 문장의 금지어 검사는 대소문자를 구분하는 단순 포함 검사여서 `afternoon`의 `after`나 `invariant`의 `variant`처럼 단어 일부만 일치해도 `422`가 발생할 수 있다. 예를 들어 `after`는 금지어 검사에 걸리지만 `After`는 해당 검사에 걸리지 않는다. 백엔드 규칙 변경 여부를 이성집·정자비 님이 확인 중이다. 실행 중 누출 검사 실패는 `LEAK_CHECK_FAILED`로 끝나는 무효 Run이다.
- 담당: 장근창(API), 정자비(루프·사이트 설정), 권혁준(프론트). 관련 FE 이슈: [#53](https://github.com/UX-Mirror/UX-Mirror-FE/issues/53), [#54](https://github.com/UX-Mirror/UX-Mirror-FE/issues/54), [#55](https://github.com/UX-Mirror/UX-Mirror-FE/issues/55), [#56](https://github.com/UX-Mirror/UX-Mirror-FE/issues/56).
- 실서버 확인 상태: 시나리오 Run의 실행·저장·조회, `/issues` 분석 완료와 검토 후보 표시, 영어 금지어 `422` 메시지 표시("goal에 쓸 수 없는 글자가 있습니다: after")는 확인했다. 위험 동작 차단은 BE 코드상 실행 경로에 연결돼 있고, 실서버 Step의 `candidateSet.exclusionReasons`에 범위 밖 후보(`OUT_OF_SCOPE`) 제외 기록이 남는 것을 확인했다. 다만 위험 라벨·동작 사유(`DANGEROUS_ACTION`)로 걸러진 후보는 아직 나오지 않았고, FE는 이 값을 화면에 쓰지 않는다. 지도 없는 사이트의 "계산 불가" 안내, `PENDING` → `COMPLETED` 전이 시간, 한 화면 경로 여러 개 등록은 확인하지 못했다.
- 확정되면 `docs/contracts/`를 고친 뒤 이 항목을 지운다.

<a id="oi-12"></a>
### OI-12 UX Optimizer 응답 형식·이유 코드

- 범위: `POST /api/optimizations`, `GET /api/optimizations/{id}`, `POST …/{id}/verify`, `GET …/{id}/report`와 Run의 `optimizationContext`. 엔드포인트와 사용법은 [REST API](../contracts/rest-api.md), 폴링은 [실행 상태와 폴링](../contracts/run-lifecycle.md)에 있다.
- 계약서: 계약 v1.3.8(§17.12, §4.9, §6.1)에 반영됐지만 이 저장소의 계약 문서는 v1.3.5라 옮기지 않았다. 반영은 [#43](https://github.com/UX-Mirror/UX-Mirror-FE/issues/43)에서 한다.
- 임시 결정: 필드는 UX-Mirror-BE `api/optimizer.py`·README 기준으로 DTO(`src/api/dto/optimization.ts`)를 만들었다. `candidateLabels`(후보 풀)처럼 화면이 쓰는 필드만 도메인으로 가져오고 해시·원본 요청 참조(`snapshotHash`, `rawRequestRef` 등)는 가져오지 않는다. 검증 시작 응답의 `baselineRunId`·`validationRunId`는 `null`로 읽는다(서버가 Run을 만들기 전에 응답하므로 시작 응답에서는 항상 `null`이고, `GET` 폴링 중에 기준 Run → 후보 Run 순으로 채워진다. 실서버·BE 코드 확인).
- 확정되지 않은 값(정책 모듈 `uxm/optimizer_policy.py`, 정윤희): 선정 이유 `selection.selectionReasonCode`, 제외 이유 `excludedCandidates[].reasonCodes`, 후보 무효 이유 `invalidReasons`, 선정·판단의 근거 형식. 판단 이유 `verification.reasonCode`와 최종 판단 `finalDecision`(또는 `decision`)의 값 목록은 BE `uxm/optimizer_policy.py` `judge_verification` 기준으로 확인했다(최종 판단 `IMPROVEMENT_OBSERVED`·`HOLD`·`NEEDS_MORE_EVIDENCE`·`INCONCLUSIVE`, 판단 이유 `NAVIGATION_COST`·`GOAL_REACHED_GAINED`·`GOAL_REACHED_LOST`·`BOTH_GOALS_NOT_REACHED`·`INVALID_OR_MISSING_RUN_DATA`·`RUN_CONDITIONS_MISMATCH_OR_MISSING`). 화면은 이 값에 풀이를 붙이고 모르는 값은 원문으로 둔다. 값 목록이 정해지기 전에는 모르는 값을 오류로 만들지 않고 문자열 원문을 그대로 두며, `selection`·`verification` 안의 필드는 모두 없을 수 있다고 읽는다. 근거 형식은 타입으로 만들지 않았다.
- 실서버 확인(11-19, UX-Mirror-BE develop `d318ee5`, 사이트 서버 5개·모델 `http` 백엔드로 평가 → 검증 → 보고서 → 비교 `200`까지 실행): DTO·Adapter가 실제 응답(`GET`·`report`·검증 Run의 `optimizationContext`)을 오류 없이 읽었다. 확인된 값: `selectionReasonCode` `TOP_TARGET_PROBABILITY`, `excludedCandidates[].reasonCodes` `GOAL_PATH_DECREASE_EXCEEDED`, `finalDecision` `IMPROVEMENT_OBSERVED`, `verification.reasonCode` `NAVIGATION_COST`, `siteInstanceId` `site-c0`~`site-c4`. `selection.selectionStatus`(`SELECTED`·`NOT_SELECTABLE`)와 `rankedCandidates`는 도메인 `OptimizationSelection`의 `status`·`rankedCandidateIds`로 가져온다. 적격 후보가 없으면(`NOT_SELECTABLE`) `verificationCandidateId`가 `null`이라 검증을 시작할 수 없고 `POST /verify`가 `409 OPTIMIZATION_NOT_READY`다. 응답에는 DTO에 없는 필드(`siteRecheck`, `trace`)가 더 있다. `verification.navigationCostDelta`는 #70에서 DTO·도메인에 추가했고(`null`이면 계산 불가) 값은 후보 − 기준이다(11-19 실서버: 이동 비용 기준 3, 후보 2 → `-1`). 서버는 판단 이유가 `NAVIGATION_COST`(두 Run 모두 목표 도달)일 때만 채우고 다른 이유에서는 `null`이라, 화면은 `NAVIGATION_COST`가 아닌 이유의 `null`을 "해당 없음"으로 보인다. `siteRecheck`는 후보 ID별 `{siteInstanceId, snapshotHash, checkedAt}`이고 사이트 재확인에 실패하면 `null`이다. 해시는 내부 값이라 화면에서 쓰지 않고, 실패는 `error.code`로 구분한다. 이 한 번의 실행으로 값 목록 전체가 확정되지는 않는다(제외·무효 이유의 다른 값, 실패 경로는 확인하지 못했다).
- mock: 제외 이유는 정책 모듈 코드(`uxm/optimizer_policy.py`)를 따라 `EVALUATION_NOT_COMPLETED`에 오류 코드·`invalidReasons`를 이어 붙인다. 시나리오와 시드는 `src/mocks/fixtures/optimization.ts`의 주석을 따른다.
- 확인할 것: 정책 모듈의 선정·무효·제외 이유 코드 값 목록과 근거 형식, `GET /api/runs` 목록 항목에 `optimizationContext`가 없어(상세 `GET /api/runs/{runId}`에는 있다) 목록에서는 Optimizer Run을 구분하지 못한다. FE는 필드가 오면 구분해 표시하도록 구현했고 BE 담당(정자비·정윤희)에게 목록 응답에 넣을지 확인한다. 실서버 확인(11-19, #70): 평가 → 검증 시작 → 기준·후보 Run 링크 → 보고서 → 비교 화면과 `SITE_RECHECK_FAILED`(후보 사이트 8002를 끈 채 검증 시작, Run 미생성)·`409 OPTIMIZATION_ALREADY_PROCESSED`를 확인했다. 확인하지 못한 것: `SITE_INSTANCE_CHANGED`·`RUN_TIMEOUT`·`OPTIMIZATION_INTERRUPTED`·`503 MODEL_UNAVAILABLE`·`422 EXPERIMENT_CONDITION_MISMATCH` 실서버 응답, 검증 후보가 C2가 아닌 경우.
- 확정되면 `docs/contracts/`를 고치고 DTO의 `임시` 표기를 없앤 뒤 이 항목을 지운다.

<a id="oi-13"></a>
### OI-13 자동 개선 결과(`improvement.json`) 형식

- 범위: 자동 개선 에이전트가 만드는 `improvement.json`(`schemaVersion: improvement-v1`). 1단계(해커톤)에서는 백엔드 API 없이 정적 JSON을 읽는다. 계약서에 없는 형식이다.
- 임시 결정: 팀이 확정한 샘플(`public/improvements/imp_SAMPLE_0001.json`, `sample: true`)을 정본으로 삼는다. 샘플의 `_required`·`_displayRules`를 따라 `src/adapters/improvement.ts`가 report·official·rounds·verification 네 영역을 각각 `{ ok, data | reason }`로 검증하고, 한 영역이 오류여도 다른 영역은 정상 변환한다. `null`은 "값 없음"이라 0으로 바꾸지 않고, 모르는 enum 값은 원문 문자열로 둔다. 점수 표시 변환(`%`·`%p`)은 `src/domain/improvementScore.ts` 한 곳에 둔다.
- 임시: 검증 Run의 빈 `issues`만으로 분석 대기·실패·정상 빈 결과를 구분할 수 없다. 무효 Run은 "판단 불가", 그 밖에는 "저장된 Issue 없음 (분석 상태 확인 불가)"로 표시한다. BE PR #110의 `_run_view`는 분석 상태 없이 목록만 저장하므로 상태 필드와 값이 확정되면 표시를 구분한다.
- 샘플이 정본이다. 탈락 사유 코드는 BE 실제 코드 기준 이름(`GUARD_LOSS_EXCEEDED:<목표>`, `MAIN_GAIN_INSUFFICIENT`, `TRUNCATED_LABEL`, `LABEL_TOO_LONG`, `EXISTING_LABEL` 등)을 쓰고 모르는 코드는 원문으로 보인다. 검증 쌍 키(`goalKey` `S1`, experimentKey `imp-1119-s1` 형식)는 BE #102와 샘플이 다를 수 있어 정자비가 확인한다. 샘플의 `path`·`stepCount`·`issues`·`goalReached`는 `improvement.json`을 만드는 쪽이 Run을 읽어 채운다. 공식 결과(`imp-1119.json`)는 `NO_IMPROVEMENT`(개선안 미채택, 검증 `NOT_RUN`, `official: null`)이고, 연습 실행(개선안 채택 예시)은 공식이 아니라 아직 화면에 반영하지 않았다.
- 전달 방식: 1단계는 `public/improvements/<id>.json` 정적 파일이다(반영 절차는 [자동 개선 JSON 반영 절차](improvement-release.md)). 2단계에서 `GET /api/improvements/{id}`로 바꿀 예정이며, 바뀌면 `useImprovement`의 읽기 부분만 교체한다.
- 형식을 바꿔야 하면 정자비(생성 담당)와 먼저 합의한다. 계약서 갱신은 통합 후 정자비가 한 번에 한다.
- 담당: 정자비(생성·계약서), 권혁준(프론트). 관련 FE 이슈: #77, #82.
- 확정되면 `docs/contracts/`를 고친 뒤 이 항목을 지운다.
