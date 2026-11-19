# REST API 소비 규칙

프론트가 호출하는 endpoint의 정본은 계약서 §17이다. 이 문서는 화면별 사용처, 요청 값의 출처, 오류와 빈 데이터 처리만 정한다. Run·Step 등 공통 응답 타입은 [데이터 모델](data-model.md), 비교 응답 타입은 [비교 데이터 모델](comparison-data-model.md)에 있다. `P0`는 MORO MARKET Before/After 범위다.

## 공통 규칙

- Base URL은 `VITE_API_BASE_URL`이다. 본문은 JSON(UTF-8)이고 스크린샷만 `image/png`다. `계약 §3`
- 필드명은 `camelCase`, enum은 `UPPER_SNAKE_CASE`, 시각은 timezone offset이 있는 ISO 8601이다. `계약 §3.1~3.3`
- 확률은 0~1 숫자이고 계산할 수 없는 값은 `null`이다. `null`을 0으로 바꾸지 않는다. `계약 §3.5~3.6`
- ID는 불투명한 문자열이다. 단 `stepId`는 Run 안의 1부터 시작하는 정수다. `계약 §3.4`
- 모든 오류 응답은 `{ "error": ErrorDetail }`이다. `계약 §16.1`

### 오류 처리

| 상황 | 프론트 처리 |
| --- | --- |
| `error.retryable = true` | 재시도 버튼을 보인다 |
| `error.retryable = false` | 재시도 없이 `error.message`만 보인다 |
| `error.details` | 화면에 표시하지 않는다 (`계약 §16.1`) |
| 응답 본문이 `{error}` 형식이 아님(네트워크 오류, 프록시 오류) | "서버에 연결할 수 없습니다" 일반 안내와 재시도를 보인다 |

`code`가 정해진 값이면 코드로, 아니면 HTTP 상태 코드로 분기한다. 오류 코드 목록은 `계약 §4.9`이고 사용하는 값은 아래 endpoint별 표에 있다.

## endpoint

| Method | Endpoint | 화면 | 정본 |
| --- | --- | --- | --- |
| GET | `/api/presets` | - (화면에서 호출 안 함) | `계약 §17.9` |
| GET | `/api/health` | 전체 | `계약 §17.8` |
| GET | `/api/sites` | 시나리오 테스트, 시나리오 Run 진행·결과 화면 | `임시` ([OI-11](../operations/open_issue.md#oi-11)) |
| GET | `/api/runs` | 1, 3 | `계약 §17.10` |
| POST | `/api/runs` | 1, 시나리오 테스트 | `계약 §17.2`, `§5.1` |
| GET | `/api/runs/{runId}` | 2, 3, 4 | `계약 §17.3` |
| GET | `/api/runs/{runId}/steps` | 2, 3, 4 | `계약 §17.4` |
| GET | `/api/runs/{runId}/issues` | 3 | `계약 §17.5` |
| GET | `/api/runs/{runId}/screenshots/{stepId}` | 2, 3, 4 | `계약 §17.7` |
| GET | `/api/runs/{runId}/screenshots/goal` | 3 | 임시, [OI-3](../operations/open_issue.md#oi-3) |
| GET | `/api/comparisons/{experimentKey}` | 4 | `계약 §17.6` |
| POST | `/api/optimizations` | 6 | `계약 v1.3.8 §17.12`, 임시 [OI-12](../operations/open_issue.md#oi-12) |
| GET | `/api/optimizations/{id}` | 7 | 같음 |
| POST | `/api/optimizations/{id}/verify` | 7 | 같음 |
| GET | `/api/optimizations/{id}/report` | 7 | 같음 |

`/events` 조회는 `P1`이라 프론트는 호출하지 않는다.

### GET /api/presets

목표·사용자 유형을 직접 입력하게 되면서 화면에서는 호출하지 않는다([OI-9](../operations/open_issue.md#oi-9)). API 함수(`src/api/presets.ts`)와 mock은 남겨 둔다. 응답은 `goals`(`goalId`, `goal`)와 `personas`(`personaId`, `persona`)뿐이다. 사이트·버전 이름·변경 내용·최대 탐색 횟수 범위는 응답에 없으므로 프론트 상수로 둔다. 변경 내용은 Before 상단 메뉴 라벨 `이용정보`가 After에서 `주문·환불`로 바뀐 한 곳이고(UX-Mirror-BE `scripts/build_shop.py`), 최대 탐색 횟수는 1~15에 기본 8이다. 서버도 같은 범위로 검사하며 범위 밖이면 `422 CONTRACT_VALIDATION_ERROR`다.
- `testOnly` 목표는 기본 응답에 없고 프론트는 `?includeTest=true`를 쓰지 않는다.

- 빈 배열이면 분석을 시작할 수 없으므로 시작 버튼을 비활성화하고 안내를 보인다.
- 요청이 실패하면 오류 안내와 재시도를 보인다.

### GET /api/health

화면 1의 엔진 상태 표시와 시작 가능 여부 판단에 쓴다. `status`(`READY` / `NOT_READY`), `activeRun`, `checkedAt`을 쓴다. `status`는 모델·브라우저·에이전트(`agent.ready`)가 모두 준비되면 `READY`다. `model.endpointId`는 비밀 URL이 아닌 식별자이며 화면에 표시하지 않는다.

- 준비 성공이 탐색 성공을 보장하지 않는다(`계약 §17.8`). "엔진 준비 완료"로만 표시하고 "분석 성공 가능"으로 표시하지 않는다.
- `status`가 `READY`가 아니면 분석 시작을 막고 다시 확인할 수 있게 한다. 상태 조회가 실패한 경우에는 분석 시작을 막고 확인 불가를 안내한다.
- `activeRun`은 실행 중인 Run의 `runId` 문자열이고(없으면 `null`), 값이 있으면 다른 Run이 실행 중이므로 새 분석 시작을 막고 해당 Run으로 이동하는 링크를 보인다.
- `activeOptimization`(`{optimizationId, status}` 또는 `null`)은 UX Optimizer가 후보를 평가·검증하는 동안 값이 있다(계약 v1.3.8 §17.8, 이 저장소의 나머지 문서는 v1.3.5 기준이며 반영은 [#43](https://github.com/UX-Mirror/UX-Mirror-FE/issues/43)에서 한다). 필드가 없는 응답은 `null`로 읽고 모르는 `status`는 "진행 중"으로 보인다. 이 동안 `POST /api/runs`는 `409 RUN_ALREADY_ACTIVE`이고 `activeRun`은 비어 있을 수 있다. 엔진 상태에 "후보 비교 중"을 표시하고, 진단하기·다른 사이트 진단은 이 동안 시작 버튼을 막고 안내를 보인다(서버도 `409`를 준다). `activeRunOwner`(`{kind, runId, external, improvementId}`, 임시 [OI-13](../operations/open_issue.md#oi-13))가 있으면 진행 중인 것이 진단·AI 개선·후보 비교 중 무엇인지 구분해 그 화면 링크를 보인다.
- 호출이 실패하면 엔진 상태를 "확인 불가"로 표시하고 나머지 화면은 계속 쓸 수 있다.

### POST /api/runs

| 요청 필드 | 필수 | 프론트 값의 출처 |
| --- | --- | --- |
| `experimentKey` | O | 프론트가 첫 Run을 만들 때 생성하고, 같은 실험의 두 번째 Run은 같은 값을 다시 쓴다. `[A-Za-z0-9_-]` 1~64자(서버가 비교 결과를 이 이름의 파일로 저장한다). 예: `exp_20261116_153045` |
| `variant` | O | `before` 또는 `after` |
| `goalId` | △ | 보내지 않는다. 예전에 preset으로 만든 실험의 두 번째 Run만 첫 Run의 값을 그대로 보낸다. `goal`과 둘 중 하나만 |
| `goal` + `verification` | O | 입력한 목표 문장과 성공 조건 `{ path, text, exact, scope }`. `goalId`와 둘 중 하나만 ([OI-9](../operations/open_issue.md#oi-9)) |
| `personaId` | △ | 보내지 않는다. `goalId`와 같은 예외만 있다. `persona`와 둘 중 하나만 |
| `persona` | O | 입력한 사용자 유형 문장. `personaId`와 둘 중 하나만 ([OI-9](../operations/open_issue.md#oi-9)) |
| `maxSteps` | X | 사용자가 입력(1~15, 기본 8). 범위는 `계약 §5.1` |
| `siteId` | X | `임시`([OI-11](../operations/open_issue.md#oi-11)). 시나리오 테스트에서만 `createRun`이 싣는다(`CreateRunInput.siteId`). 없으면 본문은 버전 비교 요청과 같다. 시나리오 테스트 화면(`/scenario`)이 선택한 사이트의 `siteId`를 보낸다 |
| `startPath`, `viewport`, `promptVersion` | X | 보내지 않는다(서버 기본값 사용) |

- 성공은 `201`이고 `{ runId, experimentKey, variant, status: "READY", maxSteps, createdAt }`다.
- 같은 `experimentKey`의 Before/After는 목표(`goalId` 또는 `goal`+`verification`), 사용자 유형(`personaId` 또는 `persona`), `maxSteps`를 같게 보낸다. 프론트는 첫 Run에 저장된 값을 두 번째 요청에 그대로 재사용한다. 다르면 서버가 `422`로 거부한다. `계약 §5.1`, [OI-9](../operations/open_issue.md#oi-9)

| 오류 | `code` | 프론트 처리 |
| --- | --- | --- |
| 409 | `RUN_ALREADY_ACTIVE` | 다른 분석이 실행 중이라는 안내. `activeRun`이 있으면 해당 Run 이동 링크, 없으면(Optimizer 진행 중 등) 서버 `message`를 그대로 보인다 |
| 409 | `EXPERIMENT_RUN_EXISTS` | 같은 키와 버전에 진행 중이거나 유효한 Run이 이미 있다는 안내와 결과 보기 링크. 기존 Run이 모두 `INVALID`일 때만 같은 키로 다시 실행할 수 있다 |
| 422 | `CONTRACT_VALIDATION_ERROR` | 서버 `message`(키 형식, `maxSteps` 범위, 없는 목표·사용자 유형, 직접 입력 문장의 빈 값·길이·금지 문자열, 성공 조건 오류, 첫 Run과 다른 입력)를 그대로 보이고 입력 수정을 안내한다. 재시도 버튼은 두지 않는다 |
| 503 | `BROWSER_ERROR` | FE는 서버 `message`를 보이고 Run이 생성되지 않았음을 안내한다. 직접 입력한 목표의 도착 화면 사전 검사에서 Before·After 어느 화면이든 열지 못하거나 화면마다 10초(요청당 최대 약 20초) 안에 응답이 없을 때도 이 코드이며 백엔드에 구현됐다(UX-Mirror-BE #60, 계약서 반영 전, [OI-9](../operations/open_issue.md#oi-9)). 메시지가 비어 있으면 "도착 화면을 확인하지 못했습니다"를 보인다. `retryable`이면 같은 버전의 실행 재시도 버튼을 보인다 |

### GET /api/sites

`임시`([OI-11](../operations/open_issue.md#oi-11), FE #53). 계약서 v1.3.5에 없어 임시 형식이다. 백엔드(UX-Mirror-BE #75)는 구현됐고 실서버 응답이 이 형식과 일치함을 확인했다. API 함수는 `src/api/sites.ts`의 `listSites()`다.

응답은 `{ items: Site[] }`이고 시나리오용 등록 사이트만 나온다(MORO MARKET 제외). 한 항목은 `siteId`, `name`, `mode`(`SCENARIO`), `startPage`, `pages`, `siteMap.available`이다. `pages`의 원소는 `pageKey`, `path`(쿼리 없음), `label`(화면 이름), `goalText`(도착 화면 확인용 글자, `null` 가능), `goalSelectable`(도착 화면으로 고를 수 있는지)이다. `goalSelectable`이 없는 응답은 Adapter가 `goalText`가 있고 시작 화면이 아닌 화면을 선택 가능으로 본다. `pages[].goalUnavailableReason`(`START_PAGE` / `NO_GOAL_TEXT` / `UNREACHABLE_ON_SITE_MAP`, 고를 수 있으면 `null`)와 `siteMap.siteMapVersion`·`siteMap.unreachablePages`(지도가 없으면 `null`)도 받는다. 사이트 이름은 Run에 없고 이 목록의 `name`으로 찾는다. mock의 `cafe24-ons` 값은 UX-Mirror-BE `config/sites/cafe24-ons.json`과 같고, 지도가 있는 사이트의 시나리오 Run은 `SITE_MAP` 기준, 없는 사이트는 `referencePathConfig: null`이다.

### GET /api/runs

쿼리 `experimentKey`, `variant`(`before` / `after`)는 선택이고 둘 다 주면 둘 다 맞는 Run만 온다. 응답은 `{ count, items }`이며 최신 Run이 먼저 온다. 한 줄은 `RunListItem`이다.

| 필드 | 설명 |
| --- | --- |
| `runId`, `experimentKey`, `variant`, `createdAt` | 식별과 생성 시각 |
| `status`, `terminationReason`, `finishedAt` | 상태. 진행 중이면 `terminationReason`·`finishedAt`이 `null` |
| `validity`, `replacementRunId` | 무효 여부와 재실행 Run. 종료 전에는 `validity`가 `null` |
| `resultOrigin` | `LIVE` / `MOCK` / `SAVED_MEASURED` |
| `goalReached` | `summary.goalReached`. `summary`가 없으면 `null` |
| `siteId`, `mode` | `임시`([OI-11](../operations/open_issue.md#oi-11)). `mode`가 `SCENARIO`일 때만 시나리오 Run이다. `null`이거나 필드가 없으면 버전 비교 Run이다 |

- 화면 1의 "마지막 Run·분석 상태·목표 달성 상태"는 `?experimentKey=&variant=`로 받은 첫 항목이고, 화면 3의 "다른 실행 보기"는 이 목록이다. 브라우저 저장소에 기록하지 않는다.
- 서버의 `results/runs/` 전체가 대상이라 다른 브라우저에서 시작한 Run과 저장된 실측 Run도 나온다.
- 손상된 Run은 목록에서 빠진다. 전체 Run은 `GET /api/runs/{runId}`로 조회한다.

### GET /api/runs/{runId}

응답은 `Run`이다. 404(`RUN_NOT_FOUND`)이면 "실행을 찾을 수 없음" 화면과 새 분석 이동을 보인다.

- 실행 중에는 `startedAt`·`finishedAt`·`terminationReason`·`summary`·`validity`가 `null`일 수 있다. `계약 §6.1`
- `siteId`·`mode`(`임시`, [OI-11](../operations/open_issue.md#oi-11))는 목록 항목과 같다. 화면 코드는 `isScenarioRun(run)`(`src/domain/site.ts`)으로 구분한다.
- `validity = INVALID`이면 결과 화면에 "무효 처리된 실행" 안내를 보이고, `replacementRunId`가 있으면 그 Run으로 이동하는 링크를 보인다.

### GET /api/runs/{runId}/steps

응답은 `{ runId, count, items: Step[] }`이다. **완전히 저장된 Step만** 오며, 진행 중인 단계는 없다.

- 시작 직후에는 `items`가 빈 배열이다(200). "첫 단계 준비 중"을 보인다.
- 프론트는 `stepId`(정수)로 정렬하지 않고 서버 순서(실행 순서)를 그대로 쓴다. `계약 §3.7`
- 같은 `stepId`가 다시 오면 내용을 덮어쓴다.

### GET /api/runs/{runId}/issues

응답은 `{ runId, analysisStatus, items: Issue[] }`이다.

| `analysisStatus` | 처리 |
| --- | --- |
| `PENDING` | "분석 대기 중"을 보인다. 종료 후에도 `PENDING`이면 [실행 상태와 폴링](run-lifecycle.md)의 규칙대로 몇 번 더 조회하고 멈춘다. 분석 전에 만들어진 Run은 계속 `PENDING`일 수 있다 |
| `COMPLETED` + `items` 있음 | 서버 순서대로 표시한다 |
| `COMPLETED` + `items` 비어 있음 | 유효 Run은 "검토 후보 없음", 무효 Run은 "무효 처리된 실행의 검토 후보가 없습니다"로 구분한다 (`계약 §14.2`). 분석 수행 여부는 추정하지 않는다 |
| `FAILED` | "분석에 실패했습니다" 안내를 보이고 나머지 결과는 계속 표시한다 |

### GET /api/runs/{runId}/screenshots/{stepId}

`?kind=original`(기본) 또는 `?kind=overlay`이며 `image/png`를 반환한다. `overlay`는 없으면 404다. 프론트는 `original`만 쓴다. 표시 방식은 [스크린샷과 bbox](screenshot-bbox.md)에 있다.

- 404(`RUN_NOT_FOUND`)이면 이미지 영역에 자리표시를 보인다. 실행이 아직 진행 중이면 "화면 준비 중", 종료됐으면 "화면 없음"이다.
- 파일 경로는 알 수 없고 주소는 `VITE_API_BASE_URL`과 이 경로로 만든다. `계약 §17.7`

### GET /api/runs/{runId}/screenshots/goal

도착 화면 이미지(`image/png`)다. 목표 화면에 도착한 Run(`GOAL_VERIFIED`)만 있고 도착하지 않았거나 사진이 없으면 `404 RUN_NOT_FOUND`다. 계약서에 없는 임시 endpoint이며([OI-3](../operations/open_issue.md#oi-3)) 주소는 `VITE_API_BASE_URL`과 이 경로로 만든다. 프론트는 `GOAL_VERIFIED`인 Run의 마지막 경로 노드에서만 호출한다. 표시 방식은 [스크린샷과 bbox](screenshot-bbox.md)에 있다.

### GET /api/comparisons/{experimentKey}

응답은 `ComparisonResult`다.

| 상황 | 처리 |
| --- | --- |
| 200 + `comparisonStatus = COMPLETED` | 화면별 비교를 모두 표시한다 |
| 200 + `comparisonStatus = PARTIAL` | 비교 가능한 부분만 표시하고, 불가능한 화면에는 `reason`을 표시한다 |
| 200 + `conditionsMatched = false` | 모든 화면이 비교 불가(`GLOBAL_CONDITIONS_MISMATCH`)이므로 `conditionChecks`의 실패 항목을 표시한다. Run 단위 결과(`runComparison`)는 그대로 표시한다 |
| 404 `RUN_NOT_FOUND` | "비교 대상을 찾을 수 없음" |
| 409 `COMPARISON_NOT_READY` | "두 버전의 분석이 모두 끝나면 비교할 수 있습니다" 안내. Run이 아직 끝나지 않았거나 Issue 분석이 `PENDING`인 경우이며 기다리면 해결되는 상태다 |
| 409 `COMPARISON_RUN_INVALID` | "유효한 실행이 없는 버전이 있습니다" 안내와 해당 버전 재분석 링크 |
| 500 `ANALYSIS_ERROR` | 오류 안내와 재시도 |

- 직접 입력한 Run의 비교 조건은 `GOAL_MATCHED`가 목표 문장과 `verification`, `PERSONA_MATCHED`가 사용자 유형 문장을 기준으로 판정한다. `verification`이 없는 과거 Run은 확인 불가로 처리되어 `PARTIAL`이 될 수 있다([OI-9](../operations/open_issue.md#oi-9)).

`COMPARISON_NOT_READY`와 `RUN_NOT_FOUND`는 화면 문구를 구분한다. 한쪽이 진행 중이면 기다리라는 안내이고, 키가 없으면 잘못된 주소 안내다.

### UX Optimizer API (`/api/optimizations`)

라벨 후보 풀을 모델로 평가해 후보를 고르고(`POST /api/optimizations`), 고른 후보와 기준을 실제 브라우저로 다시 실행해 검증한 뒤(`POST …/{id}/verify`) 최종 판단과 보고서(`GET …/{id}/report`)를 만든다. 기존 `POST /api/runs` 흐름과 별도다. 계약 v1.3.8(§17.12, §4.9, §6.1)에 정의되며 이 저장소의 계약 문서는 v1.3.5라 아직 반영하지 않았다. 구현은 API 함수(`src/api/optimizations.ts`)·DTO·Adapter·mock과 시작·후보 평가·검증·보고서 화면(`features/optimization/`)까지다. 타입과 값 목록의 임시 결정은 [OI-12](../operations/open_issue.md#oi-12)에 있다.

| 함수 | 요청 | 응답 |
| --- | --- | --- |
| `createOptimization(sourceRunId?)` | 본문 `{}` 또는 `{sourceRunId}`. 후보 풀·목표·모델 조건은 서버가 동결하므로 보내지 않는다 | `202` `{optimizationId, status, createdAt}` |
| `getOptimization(id)` | - | 상태·`progress`·`evaluations`·`selection`·검증 Run ID·`finalDecision`·`error` |
| `startVerification(id)` | 본문 없음 | `202` `{optimizationId, status: VERIFYING, verificationPhase, baselineRunId, validationRunId}` |
| `getOptimizationReport(id)` | - | 완료된(`COMPLETED`) Optimization의 보고서 |

- 상태는 `CREATED → EVALUATING → EVALUATED → VERIFYING → COMPLETED`이고 실패는 `FAILED`다(`error.failedPhase`·`lastStatus`). `FAILED`는 오류 응답이 아니라 `200` 응답의 상태값이다. 폴링 규칙은 [실행 상태와 폴링](run-lifecycle.md)의 "Optimization 폴링"을 따른다.
- 계산할 수 없는 지표(`targetOptionProbability`, `goalPathProbability` 등)는 `null`이며 0으로 바꾸지 않는다. 사유는 `metricNullReasons`(지표 이름 → 코드)이다. `baseUrl` 같은 내부 주소는 응답에 없다.
- 검증 Run은 `experimentKey`가 `optimizationId`이고 기준은 `variant=before`, 후보는 `after`다. 어느 라벨 사이트인지는 `variant`가 아니라 Run의 `optimizationContext`(`optimizationId`, `candidateId`, `label`, `executionRole`, `siteInstanceId`)로만 구분한다. 일반 Run에는 이 필드가 없고 Adapter는 `null`로 읽는다. 비교는 기존 `GET /api/comparisons/{optimizationId}`를 쓴다.
- 선정 이유(`selection.selectionReasonCode`, `excludedCandidates[].reasonCodes`)·판단 이유(`verification.reasonCode`)·`finalDecision`·`invalidReasons`는 정책 모듈이 정하는 값이다. 목록이 확정되기 전이므로 모르는 값을 오류로 만들지 않고 원문 문자열을 그대로 둔다.
- 오류 코드와 화면 문구는 `src/domain/optimizationErrors.ts` 한 곳에서 정하되, 같은 코드가 상황마다 뜻이 달라 세 함수로 나눈다. API 오류 응답은 서버 `message`를 우선하고(없을 때만 코드별 대체 문구), `FAILED`인 Optimization의 `error.code`와 후보 평가의 `error.code`(후보 하나만 실패, 평가는 계속)는 각각 따로 문구를 정한다. 모르는 코드는 서버 `message`를 그대로 쓴다.

| HTTP | `error.code` |
| --- | --- |
| 404 | `OPTIMIZATION_NOT_FOUND` |
| 409 | `OPTIMIZATION_NOT_READY`(평가 전 검증 요청, 완료 전 보고서), `OPTIMIZATION_ALREADY_PROCESSED`, `RUN_ALREADY_ACTIVE`(다른 Run·Optimization 진행 중) |
| 422 | `INVALID_SITE_INSTANCE`, `EXPERIMENT_CONDITION_MISMATCH` |
| 503 | `MODEL_UNAVAILABLE`, `OPTIMIZER_POLICY_UNAVAILABLE` |

실패한 Optimization의 `error.code`는 `BASELINE_INVALID`, `BASELINE_NOT_EVALUATED`, `MODEL_TIMEOUT`, `SITE_INSTANCE_CHANGED`, `SITE_RECHECK_FAILED`, `RUN_TIMEOUT`, `OPTIMIZATION_INTERRUPTED`, `OPTIMIZATION_FAILED`다. 후보 하나의 평가는 `evaluationStatus`가 `COMPLETED`·`FAILED`(예: `BROWSER_ERROR`)·`SKIPPED`(`candidateValidity: INVALID_CANDIDATE`)이고 다른 후보의 평가는 계속된다.

## P1 (구현된 기능이 아님)

새 버전 등록, 다중 버전 관리, 같은 버전의 여러 Run 선택, 임의 두 버전 비교, 전체 버전 변화 추적, `/events` 조회.
