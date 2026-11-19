# 프론트엔드 구조

## 실행 환경과 흐름

- 프론트(React + TypeScript + Vite, `http://localhost:5173`)는 FastAPI(`http://127.0.0.1:8000`)와만 통신한다. Zoro-1 GPU 서버와 쇼핑몰에는 직접 접근하지 않는다.
- 흐름: 분석 조건 선택 → `POST /api/runs` → `runId` 수신 → 폴링으로 상태 조회 → 종료 후 단일 Run 결과 표시. 변경 후 버전과의 비교는 자동 개선 최종안 행의 비교 링크로 연다.
- 장기 데이터 계층은 `Project → Version → Run → Step`이다. P0 백엔드는 MORO MARKET의 Before/After(`variant`)만 다루므로 Version 관리는 `P1`이다.
- API와 타입의 정본은 계약서다([문서 목차](../README.md)). 이 문서는 화면별 사용처와 표시 규칙만 정한다.

## 화면별 사용 API

핵심 흐름은 화면 두 개(1~2)와 거기서 여는 비교 화면(3)이고, 4~6은 메뉴에 없고 주소로만 연다(#100). 화면 배치와 시각 규칙은 아래 "스타일" 절을 따른다.

| # | 화면 | 사용 API | 화면 상태(서버 데이터 아님) |
| --- | --- | --- | --- |
| 1 | 첫 화면 (`/`) | `GET /api/health`, `GET /api/sites`, `POST /api/runs` | 사이트 주소, 적은 할 일, 직접 고른 화면 |
| 2 | 결과 (`/runs/:runId`) | `GET /api/runs/{runId}`(진행 중 폴링), `/steps`, `/screenshots/{stepId}`, `/screenshots/goal`, `/issues`, `GET /api/improvements`, `POST /api/improvements`, `GET /api/improvements/{improvementId}`(진행 중이면 3초 폴링) | 접힌 상세의 펼침 여부 |
| 3 | 지금 화면 vs 개선안 | `GET /api/comparisons/{experimentKey}`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` | 접힌 상세의 펼침 여부 |
| 4 | 개선안·받은 개선안 (`/improvements/:id`, `/improvements`) | `GET /api/improvements/{improvementId}`, `GET /api/improvements` | 없음 |
| 5 | 메뉴 이름 후보 비교 | `GET /api/health`, `POST /api/optimizations` | 시작 중 여부, 시작 오류 문구 |
| 6 | 후보 비교 결과 | `GET /api/optimizations/{optimizationId}`(폴링), `POST /api/optimizations/{optimizationId}/verify`, `GET /api/optimizations/{optimizationId}/report` | 없음 |

`GET /api/health`는 모든 화면의 공통 영역(엔진 상태 표시)에서 호출하고, 라우트가 바뀔 때마다 다시 조회한다(다시 조회하는 동안은 이전 결과를 보인다). 화면 1에서는 시작 가능 여부 판단에도 쓴다. 화면 3은 `CandidateComparison`에 `bbox`가 없으므로 `beforeRunId`·`afterRunId`의 `/steps`에서 해당 Step을 가져온다.

상단 줄(`shared/Layout.tsx`)에는 로고(`/`), "새 진단"(`/`), 엔진 상태, 테마 버튼만 있다. 다른 메뉴는 없다.

### 1. 첫 화면

구현은 `features/new-analysis/NewAnalysisPage.tsx`다. 예전 `/scenario`(다른 사이트 진단)는 이 화면으로 보낸다.

- 진단할 사이트([OI-8](../operations/open_issue.md#oi-8), [OI-11](../operations/open_issue.md#oi-11)): 주소 칸과 칩이 있다. 칩은 "예시 쇼핑몰로 해 보기 (MORO MARKET)"(기본)과 `GET /api/sites` 중 `siteUrl`이 있는 등록 사이트다. 주소 칸이 비어 있으면 예시 쇼핑몰이고(`siteId` 없이 실행), 주소를 넣으면 도메인이 `allowedHosts`에 있는 등록 사이트를 찾는다(`features/scenario/siteLink.ts`, `https://`가 없어도 읽는다). 등록되지 않은 주소·주소가 아닌 글은 안내하고 시작을 막는다. 사이트 목록을 못 불러와도 예시 쇼핑몰은 진단할 수 있다.
- 무엇을 하려고 하나요?: 문장 한 칸과, 누르면 칸을 채우는 예시 두세 개(예시 쇼핑몰은 정해 둔 문장, 등록 사이트는 화면 이름으로 만든 문장).
- 찾아야 할 화면은 먼저 묻지 않는다. 문장의 낱말로 화면 하나를 고른다(`matchScreen.ts`의 `matchScreen`: 화면마다 문장에 들어 있는 낱말 수를 세어 1등 하나. 예시 쇼핑몰은 `MORO_KEYWORDS`, 등록 사이트는 화면 이름·확인 글자의 두 글자 이상 낱말). 고르면 "찾아야 할 화면: OO · 바꾸기" 한 줄로 보이고, 맞는 낱말이 없거나 1등이 둘 이상이면 짐작하지 않고 "어느 화면을 찾아야 하나요?" 선택 칸을 보이며 고르기 전에는 시작하지 않는다. 직접 고른 화면은 문장을 고쳐도 바뀌지 않고, 사이트를 바꾸면 지운다. 등록 사이트의 화면은 서버가 정한 `goalSelectable`만 따른다.
- 누가(고객 유형)는 묻지 않는다. API는 `persona`가 필수라 `shared/customerInput.ts`의 `DEFAULT_PERSONA` 한 값을 숨겨서 보낸다(`임시`, [OI-9](../operations/open_issue.md#oi-9)). 확인 글자(`verification.text`)·최대 클릭 수(`STEPS.default`)도 정해진 값으로 채우고 보이지 않는다. 실험 키는 시작할 때마다 `createExperimentKey()`로 새로 만든다.
- 요청: 예시 쇼핑몰은 `variant: before`, `verification: {path, text, scope: 'page'}`(`GOAL_SCREENS`), 등록 사이트는 `variant: before`, `siteId`, `verification: {path, text: goalText}`다. 성공하면 `/runs/:runId`로 간다.
- 문장 검사는 `shared/inputRules.ts`(BE `api/input_rules.py`와 같은 규칙: 공백 뺀 4자 이상, 글자 2개 이상, 한 글자가 60% 넘지 않음, 금지어 없음)로 시작 전에 칸 아래에 안내한다. 서버도 같은 규칙으로 `422`를 준다. 시작 오류는 서버 `message`를 보이고(`409 RUN_ALREADY_ACTIVE`는 진행 중 안내), 비어 있으면 대체 문구다.
- 엔진 상태(`GET /api/health`)가 `READY`가 아니거나 다른 진단·AI 개선·후보 비교 중(`activeRun`·`activeRunOwner`)이면 시작을 막고, 진행 중인 화면으로 가는 링크를 보인다. 바쁠 때만 3초마다 상태를 다시 읽는다(`useHealth`).

### 2. 결과

경로 `/runs/:runId`(예전 `/runs/:runId/result`도 같은 화면), 구현은 `features/run-result/RunPage.tsx`다. 번호가 붙은 단계(`shared/Timeline.tsx`)가 위에서 아래로 채워진다. 서비스는 사용자의 사이트를 바꾸지 않는다. 바꿀 이름을 제안하고 AI가 보는 화면에서만 그 이름으로 다시 해 본 결과를 보이며, 반영은 사용자가 한다. 화면 문구에는 "고치다"를 쓰지 않고 "바꾸다"·"개선안"을 쓴다. 아직 오지 않은 단계는 질문만 흐리게 보인다.

- 머리: 어디서 무엇을 찾는지 한 줄(MORO MARKET / 등록 사이트 이름 / 메뉴 이름을 바꿔 본 화면, 기준 실행은 "MORO MARKET (지금 화면)" · 찾을 화면)과 제목(하려는 일). 고객 유형은 보이지 않는다.
- ① 잘 찾아가나요?: 진행 중에는 "N번째 클릭 중 · 최대 M번", 마지막 화면 스크린샷(후보 박스), 지금까지 누른 곳(폴링은 `run-progress/useRunProgress.ts`). 끝나면 "N번 만에 찾았어요" / "못 찾았어요" / "진단을 끝내지 못했어요"(무효·오류·도달 여부 없음)와 지나간 길, 접힌 "클릭별로 자세히 보기"(펼칠 때만 스크린샷을 읽는다).
- ② 왜 그랬을까요?: 끝낸 진단에만 있다. 답은 `features/run-result/why.ts`의 `explainRun`이 서버 값에서 만든다(아래 "이유 문장"). 그 아래 누를 가능성 막대 상위 4개(AI가 이름을 바꿀 수 있는 메뉴에는 "바꿀 수 있어요" 표시, 4개 안에 없으면 한 줄 더)와 접힌 "살펴볼 점 N개".
- ③ 어떻게 바꾸면 좋을까요? · ④ 바꾸면 얼마나 좋아질까요?: 직접 한 예시 쇼핑몰(MORO MARKET) 지금 화면 진단이 유효하게 끝났을 때만 있다(`features/improvement/ImprovementSteps.tsx`). 후보 비교·AI 개선이 만든 확인용 진단에는 없고, 등록 사이트 진단에는 ② 아래에 "개선안 받아 보기는 지금 예시 쇼핑몰에서만 돼요." 한 줄만 있다.
  - 서버는 종료 상태를 먼저 쓰고 `validity`를 조금 뒤에 채우므로, 종료 상태인데 `validity`가 `null`이면 최대 10번 더 조회한다(`useRunProgress`의 `MAX_VALIDITY_WAITS`). 그동안 ③④는 열지 않는다.
  - 이 진단에서 전에 시작한 AI 개선은 `GET /api/improvements`에서 `input.sourceRunId`가 같은 것 중 가장 최근 것을 찾는다(`useRunImprovement`). 가장 최근 것이 끝내지 못한 것(`FAILED`·`INTERRUPTED`)이고 전에 끝난 결과가 있으면 그 결과를 보이고 "개선안 다시 받아 보기"를 둔다. 시작 요청이 실패하면(다른 탭에서 이미 시작했거나 응답을 못 받은 경우) 목록을 다시 읽어 이미 만들어진 것을 이어서 보인다. 그래서 다시 열어도 같은 자리에 보인다. 없으면 ③에 "AI에게 개선안 받아 보기"(`POST /api/improvements {sourceRunId}`)를 둔다.
  - 시작하면 ③ 안에 세 단계 체크(이름 후보 찾기 → 개선안 만들기 → 다시 확인)와 "5분쯤 걸려요"를 보이고 3초마다 다시 읽는다(`useImprovement`. 조회가 실패해도 받은 내용을 두고 5초마다 다시 시도한다).
  - 끝나면 ③은 "상단 메뉴 'A' → 'B'" 또는 "이름만 바꿔서는 나아지지 않았어요"(+ 마지막 확인에서 떨어진 이유). ④는 찾아올 가능성 전 → 후와 변화량, "실제 사이트는 바뀌지 않아요. 이 이름으로 바꿔서 반영해 보세요.", "다른 목표도 괜찮아요"(목표별 숫자는 접힘), "개선안에서 다시 해 봤어요"(지금 화면 / 개선안 두 줄과 "화면별로 비교하기"), 접힌 "어떻게 골랐는지 보기"(시험한 이름·점수 계산), 한계 한 줄과 출처(`kind`) 표시.
  - 권하는 것은 마지막 확인까지 통과한 이름뿐이다(`summary.scoreSource`가 `OFFICIAL_B`). 후보 찾기만 끝난 결과는 "아직 확정된 개선안이 없어요"로 보이고, 다시 해 보지 않은 까닭은 `verification.reason`으로 구분한다(`NOT_FINALIZED`·`SKIPPED_BY_OPTION`은 "아직 다시 해 보지 않았어요"). 확정된 이름인데 다시 해 보다 멈췄으면(`verification.status` `FAILED`) 반영하라는 말 대신 확인을 끝내지 못했다고 쓴다. 끝났는데 리포트가 없으면 "다시 불러오기"를 둔다.
  - 시작 실패 안내는 `shared/serverMessage.ts`가 정한다. 알려진 코드는 정해 둔 문장, 그 밖에는 서버 문장이 경로·영문 식별자 없는 한글일 때만 그대로 보인다(첫 화면의 진단 시작도 같다).
  - 확정 전(진행 중)·끝내지 못한 후보는 "아직 확정 아니에요"·"이 이름은 권하지 않아요"로만 보이고, 끝내지 못했으면 "개선안 다시 받아 보기"를 둔다.

#### 이유 문장

`explainRun`은 확인되는 것만 말하고 원인을 지어내지 않는다.

- 멈춘 이유: `terminationReason`을 `shared/runLabels.ts` 문구로. 도착했으면 ①의 "N번 만에"와 같은 기준인 `summary.attemptedExtraSteps`를 쓴다(양수면 "N번 더 눌렀어요", 0이고 `backCount`도 0이면 "헤매지 않았어요", 0인데 되돌아간 적이 있으면 "N번 되돌아갔어요", `null`이면 돌아갔는지 말하지 않는다). 고른 버튼이 실제로 눌리지 않았으면(`action.executed` false) "누르려 했어요"라고 쓴다.
- 길에서 벗어난 화면: 서버가 Run에 저장한 경로 기준(`referencePathConfig` → `Run.referencePath`)으로 "목표에 가까워지는 버튼"을 서버의 `goalPathProbability`와 같은 규칙으로 고른다(`onPathCandidates`: 사이트 지도 기준은 목적지 거리가 더 짧은 버튼, 허용 경로 기준은 첫 화면에서만). 그런 버튼이 있었는데 다른 것을 고른 첫 화면을 짚어 "첫 화면에서 'A'를 눌렀어요. 누를 가능성 X%." "목표로 가는 'B'는 Y%였어요."라고 쓴다.
- 고른 버튼들의 확률 합이 그 Step의 `goalPathProbability`와 0.01 넘게 다르거나, 경로 기준·`goalPathProbability`가 없거나, 등록 사이트 진단이면 버튼을 짚지 않고 멈춘 이유와 첫 화면에서 누른 버튼만 말한다.

### 3. 지금 화면 vs 개선안

경로 `/comparisons/:experimentKey`, 구현은 `features/comparison/`이다(#100).

- 제목, 하려는 일 한 줄(고객 유형은 보이지 않는다), 한 줄 결론("개선안에서 더 빨리 찾았어요" 등, `verdict.ts`. 설정이 다르거나 한쪽이 끝나지 않았으면 말하지 않는다).
- 양쪽 결과(몇 번 만에 도착 / 못 찾음 / 중간에 멈춤, 바꾼 메뉴 이름, "진단 보기" 링크) → "지나간 길" 나란히 → 접힌 "화면별로 자세히 보기"(두 스크린샷과 누를 가능성).
- 조건 확인 표·진단 전체 지표 표·하나씩 보기는 없앴다. 비교할 수 없으면 이유 한 줄과 돌아갈 링크만 보인다.

### 메뉴 이름 후보 비교

`임시`([OI-12](../operations/open_issue.md#oi-12), FE #69). 경로는 `/optimizations`(시작)과 `/optimizations/:optimizationId`(평가), 구현은 `features/optimization/`이다. 메뉴에는 없고 주소로만 연다(#100). 화면 제목은 `PAGE_NAMES.optimizer`(시작)·`PAGE_NAMES.optimizerDetail`("후보 비교 결과")이다. 화면은 Run이 아니라 Optimization 단위다. 화면에는 서버 코드(상태·이유·판단·오류 코드·`resultOrigin`)와 ID(후보 비교 ID·Run ID·후보 ID)를 보이지 않는다. 코드는 `labels.ts`의 문구로 바꾸고 모르는 코드는 "확인 필요"(`UNKNOWN_LABEL`)로, 후보는 이름(`label`)으로, Run은 "진행 보기"·"결과 보기" 링크로 보인다. 원문 코드는 CSS용 `data-*` 속성에만 남는다.

- 시작: "후보 평가 시작"이 `createOptimization()`을 호출하고 성공하면 평가 화면으로 이동한다. 입력 칸은 없고 진단 Run은 주소의 `?sourceRunId=`로만 받는다(화면에는 "방금 본 진단 결과와 연결해 시작합니다."만 보인다). 엔진이 `READY`이고 `activeRun`·`activeOptimization`이 없을 때만 시작할 수 있으며, 아니면 이유와 진행 중인 화면 링크를 보인다. 시작 오류(`409 RUN_ALREADY_ACTIVE`, `503 MODEL_UNAVAILABLE`·`OPTIMIZER_POLICY_UNAVAILABLE`, `422 EXPERIMENT_CONDITION_MISMATCH`)는 `optimizationApiErrorMessage`로 서버 `message` 우선 문구를 보이고 시작 화면에 머문다.
- 평가: `useOptimizationProgress`로 폴링한다(`COMPLETED`·`FAILED`에서 멈추고 `EVALUATED`에서는 검증 시작을 기다리며 계속 조회한다). 후보 풀(`candidates`)을 후보 순서대로 카드로 보이고, 평가가 끝난 후보(`evaluations`)에는 결과를, 다음 후보에는 "평가 중"을, 나머지에는 "평가 대기"를 붙인다. 상태가 `FAILED`이면 끝나지 않은 후보는 "평가하지 못함"이다.
- 지표: `COMPLETED` 후보는 대상 메뉴 확률·목표 경로 확률을 보이며 `null`은 0이 아니라 "계산 불가"와 `metricNullReasons` 사유다. `FAILED` 후보는 `candidateErrorMessage` 문구, `SKIPPED`·무효 후보는 `invalidReasons` 풀이를 보인다. 기준 후보가 `INVALID_CANDIDATE`이면 모델 평가를 하지 않았다고 알린다.
- 선정 결과(`selection`이 있을 때): 추천 후보와 검증 후보를 따로 보이고(다를 수 있다), 선정 사유·`recommendationStatus`·제외된 후보와 `reasonCodes`를 보인다. 코드는 풀이만 보이고 모르는 코드는 "확인 필요"다(`features/optimization/labels.ts`). 후보 목록에 없는 후보 ID는 "알 수 없는 후보"다. `EVALUATED`이고 검증 후보가 있으면 "검증 시작"이 `startVerification()`을 호출한다. 한 번만 시작할 수 있고 어느 후보로 검증하는지(추천 후보와 다를 수 있다)를 버튼 위에 보인다. 요청 중에는 버튼을 막고, 오류(`409 OPTIMIZATION_ALREADY_PROCESSED`·`RUN_ALREADY_ACTIVE`, `503 MODEL_UNAVAILABLE`, `422 EXPERIMENT_CONDITION_MISMATCH` 등)는 `optimizationApiErrorMessage` 문구로 보인다. 검증 후보가 없으면(`NOT_SELECTABLE`) 버튼 대신 안내만 보인다.
- 실패: `error.code`를 `optimizationFailureMessage` 문구로, `failedPhase`·`lastStatus`를 문구로 함께 보인다(오류 코드는 보이지 않는다). `OPTIMIZATION_INTERRUPTED`는 시작 화면으로 가는 다시 시작 링크를 둔다.
- 검증(`VerificationPanel`, FE #70): `VERIFYING`이면 `verificationPhase`(모르는 값은 단계 문구를 붙이지 않는다)와 기준 Run(`baselineRunId`)·후보 Run(`validationRunId`)을 "진행 보기" 링크로 기존 진행 화면(`/runs/:runId`)에 잇는다. Run ID는 기준 → 후보 순으로 채워지므로 `null`이면 "아직 만들어지지 않음"이고, 서버는 Run을 만들기 전에 사이트를 다시 확인하므로 기준 Run이 없는 동안은 phase가 `BASELINE`이어도 "사이트 확인 중"으로 보인다. 기준 실행 이름(`기준 실행 ("이용정보")`)은 후보 풀의 `BASELINE` role 후보 이름이다. 검증 단계(`failedPhase=VERIFYING`)에서 `FAILED`이면 `SITE_INSTANCE_CHANGED`·`SITE_RECHECK_FAILED`는 Run이 만들어지지 않았다고 알리고, 이미 만들어진 Run은 링크로 남긴다.
- 보고서(`ReportPanel`, 상태 `COMPLETED`): `GET …/report`를 한 번 조회한다(실패하면 다시 시도 버튼). 최종 판단·판단 이유·`navigationCostDelta`와 기준·후보 Run 요약표를 보이고 `null`은 0이 아니라 "계산 불가"이고, 판단 이유가 `NAVIGATION_COST`가 아니면 `navigationCostDelta`의 `null`은 "해당 없음"이다(서버가 그때만 채운다). 한계 문구와 `resultOrigin`("실제 실행"·"저장된 실측 결과"·"예시 데이터")은 항상 보인다. 서버 `limitations.note`에는 판단 코드가 섞여 있어 그대로 보이지 않고 실행 횟수·반복 여부로 문구를 만든다. 모르는 판단·이유 코드는 "확인 필요"다. 표의 각 Run은 "결과 보기" 링크이고 방문 경로는 화면 이름(`improvement/labels.ts`의 `screenName`)이다. "비교 조건"(목표·사용자 유형·AI 호출 수·평가/검증 시간)은 접어 두며, 정책 버전·모델 버전·엔드포인트·프롬프트 버전은 보이지 않는다. `/comparisons/{optimizationId}` 링크가 있다.
- 후보 비교 확인 실행 구분: Run에 `optimizationContext`가 있으면 결과 화면 머리에 "메뉴 이름을 '주문·환불'로 바꿔 본 화면"처럼 바꿔 본 이름을 보인다. 후보 ID는 보이지 않는다. 없는 Run의 표시는 바뀌지 않는다. 비교 응답에는 이 값이 없어 각 Run(`GET /api/runs/{runId}`)에서 읽는다.
- 공통 영역의 엔진 상태에서 진행 중인 후보 비교 표시(`activeOptimization`)는 이 평가 화면으로 연결된다.

### 4. 개선안·받은 개선안

`임시`([OI-13](../operations/open_issue.md#oi-13)). 구현은 `features/improvement/`다. 메뉴에는 없다.

- `/improvements/:improvementId`: 결과에 `input.sourceRunId`가 있으면 그 진단의 결과 화면(`/runs/{sourceRunId}`)으로 바꿔 보낸다. 진단 없이 만든 결과(사전 등록 공식 결과 등)만 여기서 결과 화면의 ③④와 같은 두 단계로 보인다(`ImprovementStepsView`). 머리에는 출처(`kind`) 표시가 있다.
- `/improvements`: 지난 결과를 한 줄씩 보인다. 진단에서 시작한 결과는 그 진단 화면으로, 나머지는 `/improvements/:improvementId`로 연결한다. 시작 칸은 없다.

### 저장된 실측 결과 재생

- 메뉴에는 없고 주소(`/replay`)로만 연다(#100). 구현은 `features/replay/`다.
- `ReplayPage`가 고정 `experimentKey`(`constants.ts`의 `REPLAY_EXPERIMENTS`, E 실행 목표별 네 개) 각각으로 `GET /api/runs?experimentKey=`를 한 번씩 조회해 키마다 카드를 만들고 Run마다 진행·결과 화면 링크를 둔다. 각 실행은 Run ID 대신 버전 이름 + 시작 시각(`shortTime`) + 상태(`statusLabel`)로 구분하고 실험 키는 보이지 않는다. 새 API는 없고 `POST /api/runs` 등 Run을 만들거나 바꾸는 요청은 보내지 않는다. 조회 재시도 중에는 "연결 재시도 중"을 보인다.
- 같은 키의 비교 화면(`/comparisons/{experimentKey}`, 링크 문구 "지금 화면 vs 개선안 보기") 링크는 두 버전 각각 종료된 `VALID` Run이 목록에 있을 때만 보인다. Issue 분석 완료 여부는 목록에 없으므로 `COMPARISON_NOT_READY`는 비교 화면의 오류 안내가 맡는다.
- 재생 표시(`ReplayNotice`)는 `resultOrigin` 배지와 별개이며 원본 값은 그대로 표시한다. 진행·결과·비교 화면에서 `experimentKey`가 고정 키 목록에 있을 때만 보이고, 화면의 모든 `resultOrigin`이 `LIVE`·`SAVED_MEASURED`이면 "저장된 실측 결과 재생", 하나라도 그 밖(`MOCK`)이면 "예시 데이터 재생"이다. 출처 배지(`ResultOriginBadge`)도 코드 대신 "실제 실행"·"저장된 실측 결과"·"예시 데이터"로 보인다.
- 키는 카드마다 목록·오류·재시도·비교 링크가 독립이라 한 키의 조회 실패가 다른 키에 영향을 주지 않는다. 고정 키 값은 E 실행 최종 실행 계획의 `replay`와 같고 [OI-7](../operations/open_issue.md#oi-7)에 적었다. 서버 없는 시연은 P0에서 하지 않는다. 테스트는 `tests/replay.test.tsx`, `tests/replay-multi.test.tsx`다.

## 표시 규칙

계약서 기준으로 화면에 쓰지 않는 표현이다.

| 항목 | 규칙 |
| --- | --- |
| 이슈 우선순위 | "우선 검토 / 일반 검토" 두 단계. 높음·보통·참고 같은 심각도 표현은 쓰지 않는다 |
| 비교 판정 | "개선", "단축", "소멸", "해소됨", "~배", "~% 절감"을 쓰지 않는다. before/after 값과 서버가 준 증감만 표시한다 |
| 이슈 비교 | "탐지됨 / 탐지되지 않음"으로 표시한다 |
| 목표 판정 문구 | "목표 화면 도달". "DOM 마커 검증"은 쓰지 않는다 |
| 지표 단위 | 엔트로피에 `bit`를 붙이지 않는다 |
| 이벤트 로그·Playwright 상태 | 표시하지 않는다(`P1`) |
| 확률 | "모델의 선택 확률이며 실제 사용자의 클릭 확률이 아닙니다" 문구를 함께 둔다 |
| Run 표기 | `runId`를 그대로 표시한다 |

## 데이터 출처 구분

화면 오른쪽 위 배지는 `resultOrigin`을 그대로 표시한다(`계약 §2.1`). 비교 화면은 `beforeResultOrigin`·`afterResultOrigin`이 다르면 두 값을 모두 표시한다.

| 값 | 의미 |
| --- | --- |
| `LIVE` | 현재 실행에서 실제 Zoro-1을 호출해 얻은 결과 |
| `MOCK` | 테스트를 위해 고정하거나 생성한 모델 응답. 백엔드의 Mock 실행과 프론트 fixture가 모두 이 값을 쓴다 |
| `SAVED_MEASURED` | 과거 실제 호출 결과를 저장한 뒤 재생한 결과. 재생 방법은 위 "저장된 실측 결과 재생"과 [OI-7](../operations/open_issue.md#oi-7) |

## 계층 분리 원칙

- 화면 컴포넌트는 `fetch`를 직접 호출하지 않고 도메인 모델만 받는다.
- 서버 응답 DTO와 프론트 도메인 모델을 분리하고, 변환은 Adapter 한 곳에서만 한다. 필드명·단위·null 규칙이 바뀌어도 Adapter만 고친다.
- 데이터 공급원(Mock / 실제 API)은 API 계층 안에서 교체하고 화면은 구분하지 않는다. fixture는 실제 응답 DTO와 같은 구조로 만들고 `resultOrigin`을 `MOCK`으로 둔다.
- 서버 데이터(Run, Step, 비교 결과)와 화면 상태(선택한 단계, 펼침 여부)를 섞지 않는다.
- 값 변환(확률 ×100, 소수점 반올림, 날짜 표기)은 표시 단계에서만 하고 원본 값은 보존한다.

## 폴더 구조

```
src/
  config/env.ts            # VITE_API_BASE_URL, VITE_USE_MOCK을 한 곳에서 읽기
  styles/tokens.css        # 디자인 토큰(CSS 변수), 글꼴 로딩, 포커스·모션 기본값
  api/
    client.ts              # fetch 래퍼, ApiError(ErrorDetail 변환), apiUrl
    runs.ts, presets.ts, sites.ts, comparisons.ts, health.ts, optimizations.ts   # endpoint 함수, screenshotUrl
    dto/                   # 서버 응답 타입 (계약서 그대로)
  adapters/                # dto -> domain 변환. improvement.ts는 DTO 없이 정적 JSON(unknown)을 영역별로 검증·변환(OI-13)
  domain/                  # types.ts(도메인 모델), runStatus.ts(isTerminalStatus), site.ts(isScenarioRun, pageLabel), optimizationStatus.ts(isTerminalOptimizationStatus), optimizationErrors.ts(후보 비교 오류 문구), improvement.ts(자동 개선 결과 타입), improvementScore.ts(점수 %·%p 표시)
  mocks/                   # MSW. browser.ts, store.ts, errors.ts, fixtures/(run, scenario, runResult, comparison, sites, optimization), handlers/(endpoint별)
  features/
    new-analysis/(첫 화면, matchScreen), scenario/(siteLink만), run-progress/, run-result/(RunPage, why), comparison/, replay/, optimization/, improvement/   # 화면별. 라우트는 App.tsx
  shared/                  # Layout(상단 줄), Timeline(번호 단계·접힘)와 timeline.css, customerInput(찾을 화면·숨긴 고객 유형), hangul(조사), SectionTitle(카드 제목 줄), icons, ProbabilityGauge, stepLabel, EngineStatus, optimizationStatus, ErrorNotice, ResultOriginBadge(결과 출처 문구), optimizerRun(후보 비교 확인 실행 표시 문구), useHealth, useOptimizationProgress(Optimization 폴링)
    screenshot/            # boxStyle.ts(좌표 변환), ScreenshotViewer, CandidateProbabilityList
    polling/               # poller.ts(간격·backoff 규칙), usePolling(범용 폴링 훅)
public/
  mock/screens/            # 목업 쇼핑몰을 찍은 mock 스크린샷 PNG({before,after}/{home,mypage,orders,support,refund}.png)
  improvements/            # 자동 개선 결과 정적 JSON(공식 결과 imp-1119.json·imp-1119b.json, OI-13)
  mockServiceWorker.js     # MSW 생성 파일
```

화면 라우트는 `/`(첫 화면), `/runs/:runId`·`/runs/:runId/result`(결과), `/comparisons/:experimentKey`(지금 화면 vs 개선안), `/improvements`(받은 개선안)·`/improvements/:improvementId`(개선안 또는 진단 화면으로 보냄), `/optimizations`(메뉴 이름 후보 비교), `/optimizations/:optimizationId`(후보 비교 결과), `/replay`(지난 결과 다시 보기), `/scenario`(첫 화면으로 보냄)다. 경로는 프론트가 정한 값이며 계약서 대상이 아니다. 좌표 변환 함수, 폴링 훅 같은 화면 공용 코드는 `shared/` 아래에 둔다.

## 목업 쇼핑몰

`mock-pages/`는 mock 모드의 스크린샷 원본인 MORO MARKET 목업 쇼핑몰이다(홈·마이페이지·주문 내역·고객센터·환불 신청의 정적 HTML·CSS와 SVG 상품 이미지). 앱과는 별개의 디자인이고 개발 서버에서 `/mock-pages/home.html?v=before`(또는 `after`)로 볼 수 있다. `v`는 상단 메뉴 라벨(Before `이용정보` / After `주문·환불`)만 바꾼다.

- `npm run mock:shots`(`mock-pages/capture.mjs`)가 Chrome·Edge(`puppeteer-core`)로 1440×900 PNG를 `public/mock/screens/`에 찍는다. 이 PNG는 Git에 올리고, mock 스크린샷 API(`GET /api/runs/{runId}/screenshots/{stepId}`)가 그대로 돌려준다.
- 후보 박스 위치(`src/mocks/fixtures/scenario.ts`의 bbox)는 페이지의 `data-key` 요소와 같아야 한다. 스크립트가 찍은 뒤 두 값을 비교하고 1px 넘게 어긋나면 실패한다. 페이지 레이아웃이나 bbox를 바꾸면 `npm run mock:shots`를 다시 실행한다.

## 스타일

- 디자인 토큰은 `src/styles/tokens.css`의 CSS 변수(`--um-*`)이며 `src/index.css`가 가져온다. 색·간격·라운딩은 이 변수로만 참조하고 컴포넌트 CSS에 색 값을 새로 쓰지 않는다. 값의 출처는 Stitch 시안 v5의 `DESIGN.md`(팀 확정 전 안)이고 `devs7ud.io`의 느낌을 반영했다. 테마는 라이트·다크 두 벌이다.
- 글꼴 변수는 `--font-sans`와 `--font-mono`다. `--font-sans`는 Inter(400·500·600·700, `@fontsource-variable/inter`)를 먼저 선언해 영문·숫자는 Inter, 한글은 Pretendard(`pretendard`)로 그려지고 폴백은 `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`다. ID·코드·배지는 `--font-mono`(JetBrains Mono 400·500·600, `@fontsource-variable/jetbrains-mono`)이고 `.mono`, `.badge-mono`로 쓴다. 모노 스택에 Pretendard를 끼워 배지 안 한글이 시스템 고정폭 글꼴로 떨어지지 않게 한다. 확률·단계·표 수치와 `.num`에는 `font-variant-numeric: tabular-nums`를 적용한다.
- 레이아웃(`Layout`)은 얇은 상단 줄 하나다. 로고·"새 진단"·엔진 상태(작은 점 + 짧은 말)·테마 버튼만 둔다. 메뉴 이름 후보 비교·지난 결과 다시 보기는 주소로만 연다(#100). 본문 폭은 최대 1080px이다.
- 핵심 흐름(첫 화면, 결과, 개선안)은 가운데 좁은 한 단이다(결과 760px, 첫 화면 560px). 카드를 쓰지 않고 크기·굵기로 위계를 만든다. 결과 화면은 세로 단계(`shared/Timeline.tsx`, `shared/timeline.css`)다. 왼쪽 선 위의 번호 점(끝난 단계는 채운 점, 지금 단계는 강조색 테두리와 은은한 번짐, 아직 오지 않은 단계는 빈 점), 작은 질문, 큰 답 한 줄(34px, 좁은 화면 28px), 그 아래 본문 15px 순이다. 좁은 화면에서는 선을 접고 번호를 질문 줄에 붙인다.
- 핵심 흐름의 색: 강조색(`--um-accent`)은 누를 수 있는 것과 지금 단계에만, 노랑(`--um-highlight`)은 ④의 바뀐 뒤 가능성 숫자 하나에만 쓴다. 성공·실패는 작은 점이나 글자 색으로만 보이고 색 면을 쓰지 않는다(알림도 글자만). 주 버튼은 화면에 하나(잉크색 알약, 높이 44px)이고 나머지는 글자 링크다. 접힘은 글자만 있는 "…보기 ▾"(`Disclosure`)다. 누를 가능성은 6px 막대(이름 왼쪽, % 오른쪽)이고 AI가 이름을 바꿀 수 있는 메뉴는 "바꿀 수 있어요" 표시로 구분한다. 움직임은 단계가 나타날 때(200ms)와 지금 단계 점의 번짐뿐이고 `prefers-reduced-motion`에서는 꺼진다.
- 정보 위계는 `index.css` 끝의 "정보 위계" 블록이 정한다. 글자는 `--um-text`(제목·값), `--um-text-secondary`(본문), `--um-text-muted`(라벨·보조 문구) 세 단계로 밝기를 나누고, 면은 따뜻한 회색 바닥(`canvas`) 위에 흰 카드(`surface`)가 그림자로 떠 있고, 카드 안 칸은 `surface-subtle`, 눌림·강조 칸은 `surface-raised`다. 모서리는 카드 24px·컨트롤 12px·버튼 알약형이다. 주 버튼은 잉크색(`--um-brand`), 링크·선택은 파랑(`--um-accent`), 구역 제목 막대는 노랑(`--um-highlight`)이다. 핵심 수치는 Before(`--um-before`)·After(`--um-after`) 색으로, 구역 제목은 왼쪽 accent 막대로 구분한다. 참고한 기준은 Material 3 color roles(surface container 단계, outline과 대비 기준 3:1·4.5:1)와 Linear의 "구조는 선이 아니라 명암으로" 원칙이다.
- 기본 버튼은 보조 스타일이고, 화면의 주 행동에만 `primary`를 쓴다.
- `[role='alert']`와 `.error-notice`는 오류 스타일이고 `.error-notice[role='status']`(예: 비교 준비 중)는 정보 스타일이다. `data-origin`(`LIVE`, `MOCK`, `SAVED_MEASURED`)과 `data-status`는 배지 색을 정한다. 색만으로 뜻을 전하지 않도록 배지에는 항상 글자를 함께 둔다.
- 주소로만 여는 화면(후보 비교, 지난 결과)은 큰 제목(`page-header`: `h1`과 출처·재생 배지) 아래에 흰 카드(`card`, 24px 여백·그림자·제목 줄)가 쌓인다. 카드 안쪽 여백은 `--um-card-pad`(24px, 좁은 화면 16px)로 같다. 정의 목록(`summary-grid`)은 라벨 열 너비(168px)가 모든 카드에서 같다.
- 라이트 면 위에서 글자는 본문 `#3d414d`, 흐린 글자 `#666a77`(흰 면 위 4.5:1 이상), 제목·값 `#14141a`를 쓰고, 입력 안내·비활성(`#8a8e99`)만 그보다 옅다. 본문은 14px/22px, 카드 제목은 15~20px이고 12px보다 작은 글자는 쓰지 않는다. 화면 제목(`h1`)은 28~48px 굵게(800)다.
- 테마는 기기 설정(`prefers-color-scheme`)을 따르고, 상단 줄의 테마 버튼으로 고르면 `<html data-theme>`과 `localStorage`(`um.theme`)에 남긴다(`shared/theme.ts`, 첫 그리기 전 적용은 `index.html`의 스크립트). `tokens.css`가 다크 값을 같은 변수 이름으로 덮어쓰므로 컴포넌트 CSS는 바꿀 필요가 없다. 진한 면 위 글자는 `--um-on-brand`, 스크린샷 위 표시 색은 `--um-mark`·`--um-back-mark`다. 카드·상단 바는 그림자(`--um-shadow-card`)와 옅은 1px 테두리로 떠 보이게 하고, 장식용 글로우는 쓰지 않는다. 애니메이션은 `prefers-reduced-motion`에서 꺼진다.
- 확률은 `ProbabilityGauge`(0~100% 고정 눈금)로 보이고 옆에 숫자를 적는다. 구간별로 색을 바꾸지 않는다(좋고 나쁨의 판정처럼 보이지 않게). Before는 청록, After는 주황으로 서로 대비되는 색이고 눈금선(25% 간격)과 채움 끝 마감선이 있다.
- 스크린샷 위 후보 박스에는 윤곽선과 박스 바깥의 번호 태그만 올리고 확률 숫자는 올리지 않는다. 번호는 `CandidateProbabilityList`의 번호와 같고 확률은 그 목록에서 찾는다. 화면 맨 위에 붙은 박스는 태그를 박스 아래에 둔다. 비교 화면의 번호는 `candidateComparisons`의 행 순서를 기준으로 `semanticKey`가 같으면 두 버전에서 같다(`features/comparison/candidateNumbers.ts`).
- 시안에 있어도 계약서·현재 API에 없는 요소(버전 추가 동작, 실행 이벤트 로그 등)는 화면에 두지 않는다(비활성 버튼으로도 남기지 않는다). 서버 코드값(`status`·`terminationReason`·`issueType`·`CLICK`/`GO_BACK`·Run ID)은 화면에 그대로 보이지 않고 `shared/runLabels.ts`의 사용자 말로 바꾼다.
