# 프론트엔드 구조

## 실행 환경과 흐름

- 프론트(React + TypeScript + Vite, `http://localhost:5173`)는 FastAPI(`http://127.0.0.1:8000`)와만 통신한다. Zoro-1 GPU 서버와 쇼핑몰(8001·8002)에는 직접 접근하지 않는다.
- 흐름: 분석 조건 선택 → `POST /api/runs` → `runId` 수신 → 폴링으로 상태 조회 → 종료 후 단일 Run 결과 표시 → 두 Run 비교 조회.
- 장기 데이터 계층은 `Project → Version → Run → Step`이다. P0 백엔드는 MORO MARKET의 Before/After(`variant`)만 다루므로 Version 관리는 `P1`이다.
- API와 타입의 정본은 계약서다([문서 목차](../README.md)). 이 문서는 화면별 사용처와 표시 규칙만 정한다.

## 화면별 사용 API

화면은 네 개다. 화면 배치와 시각 규칙은 아래 "스타일" 절을 따른다.

| # | 화면 | 사용 API | 화면 상태(서버 데이터 아님) |
| --- | --- | --- | --- |
| 1 | 새 UX 분석 | `GET /api/health`, `GET /api/runs`, `POST /api/runs` | 입력한 목표·사용자 유형·성공 조건, 최대 탐색 횟수, 비교할 두 버전 선택 |
| 2 | AI 탐색 진행 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` | 열람 중인 stepId(기록 열람 / 최신) |
| 3 | UX 탐색 분석 결과 | `GET /api/health`, `GET /api/runs`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues` | 선택한 경로 노드, 열린 Issue 상세, 지표 패널 펼침 |
| 4 | 버전 비교 | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `GET /api/runs/{runId}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` | 지표 표 펼침 |

`GET /api/health`는 모든 화면의 공통 영역(엔진 상태 표시)에서 호출하고, 라우트가 바뀔 때마다 다시 조회한다(다시 조회하는 동안은 이전 결과를 보인다). 화면 1에서는 시작 가능 여부 판단에도 쓴다. 화면 4는 `CandidateComparison`에 `bbox`가 없으므로 `beforeRunId`·`afterRunId`의 `/steps`에서 해당 Step을 가져온다.

### 1. 새 UX 분석

- 사이트(MORO MARKET)·버전 이름·변경 내용(Before `이용정보` → After `주문·환불`, 상단 메뉴 라벨 한 곳)·최대 탐색 횟수 범위(1~15, 기본 8)는 프론트 상수다. 목표·사용자 유형은 preset에서 고르지 않고 직접 입력하므로 `GET /api/presets`는 호출하지 않는다.
- 분석 사이트는 입력란이다. 기본값은 MORO MARKET이며 입력값은 요청에 싣지 않는다. MORO MARKET이 아니거나 비어 있으면 안내를 보이고 분석 시작을 막는다([OI-8](../operations/open_issue.md#oi-8)). 실행할 버전에 따라 백엔드가 대상을 정한다.
- 탐색 목표·사용자 유형은 문장으로 직접 입력한다(200자까지). 목표와 함께 성공 조건(도착 화면, 화면에 보여야 할 글자 100자까지, 찾는 범위)을 입력한다. 도착 화면을 고르면 그 화면에만 보이는 제목(`GOAL_PAGES`의 `text`, 예: `주문 / 배송 조회`)을 글자 칸에 채운다. 띄어쓰기까지 화면과 같아야 판정되기 때문이다. 정확 일치는 입력받지 않고 보내지 않는다(서버 기본값 `false`, 부분 일치). 도착 화면은 서버가 실제 화면인지 검사하지 않으므로 `GOAL_PAGES` 목록에서만 고르고, 시작 화면(home)은 뺀다. 금지 문자열 등 서버 `422`는 `message`를 그대로 보인다. [OI-9](../operations/open_issue.md#oi-9)
- 버전 표의 행은 `variant`(`before`, `after`)에 대응한다. 표시 이름은 `v1 (변경 전)`, `v2 (변경 후)`다. 두 Run은 같은 `experimentKey`로 묶고 목표·사용자 유형·`maxSteps`를 같게 보낸다. 기존 실험이면 입력 칸을 첫 Run에 저장된 문장·성공 조건으로 채워 잠그고 두 번째 요청에 그대로 쓴다. 예전에 preset ID로 만든 실험은 서버가 같은 입력으로 보도록 그 ID(`goalId`·`personaId`)를 그대로 보낸다. 저장된 성공 조건이 없어 목표를 다시 만들 수 없으면 안내하고 시작을 막는다.
- 행의 "마지막 Run ID·분석 상태·목표 달성 상태"는 `GET /api/runs?experimentKey=&variant=`의 첫 항목(최신 Run)으로 채운다.
- 기존 실험 키를 입력하고 조회 버튼을 눌러 서버의 실행 기록을 조회하고 첫 Run의 조건을 다음 Run에 재사용한다. 시작 후 진행 화면 주소에도 실험 키를 남긴다.
- `+ 버전 추가`와 `v3` 행은 `P1`이라 비활성으로 둔다.
- 비교 버튼은 두 버전에 종료된 유효 Run이 있을 때만 활성화하고, 같은 버전을 두 번 고르면 오류를 보인다. 최신 Run이 무효여도 이전 유효 Run을 비교 대상으로 쓴다. 재실행은 해당 버전의 모든 Run이 무효일 때만 허용한다.
- 엔진 상태는 `GET /api/health`로 표시한다. 상태가 `READY`가 아니거나 `activeRun`이 있으면 새 분석 시작을 막는다. 상태 조회에 실패하면 시작을 막고 확인 불가를 안내하며 재확인을 제공한다.

### 2. AI 탐색 진행

- `runId`를 URL에 담아 새로고침 뒤에도 복원한다. 폴링 규칙은 [실행 상태와 폴링](../contracts/run-lifecycle.md)을 따른다.
- 탐색 화면은 원본 스크린샷 위에 후보 bbox와 확률을 겹쳐 그린다([스크린샷과 bbox](../contracts/screenshot-bbox.md)). 열람 중인 단계가 최신이 아니면 "기록 열람 중" 안내와 최신 단계 이동 버튼을 보인다.
- 화면은 위에서 아래로 실행 정보 카드(상태, 출처, 실행 ID, 버전, `Step n / 최대`, 현재 화면, 목표, 분석 결과 보기), 탐색 화면(단계 탭, 브라우저 바, 스크린샷)과 AI 선택 결과(선택된 행동, 후보 확률 게이지, 지표)의 2단, 탐색 기록(단계별 카드)이다. 아직 실행되지 않은 단계는 서버 데이터가 없으므로 진행 중인 Run에만 남은 단계를 한 장의 대기 카드로 보이고, 종료된 Run은 만들지 않는다. 진행도는 `Run.progress`를 쓴다.
- 실행 이벤트 로그와 Playwright 상태는 `/events`가 `P1`이라 표시하지 않는다.
- 분석 결과 보기는 Run이 종료 상태일 때만 활성화한다.
- 구현은 `features/run-progress/`다. `useRunProgress`가 폴링마다 Run → `/steps` 순서로 조회해(종료 응답 뒤 `/steps`가 마지막 조회가 된다) `usePolling`에 넘기고, `/steps`는 서버 순서를 유지하되 같은 `stepId`는 덮어쓴다. 열람 중인 단계는 직접 고른 `stepId`만 기억하고(없으면 최신을 따라간다), 최신 단계를 다시 고르면 따라가기로 돌아간다. 상태 문구는 `statusLabel.ts`다.
- `/steps` 오류(404 포함)는 Run 오류와 분리한다. Run 상태는 그대로 반영하고 직전 Step 목록을 유지하며 "단계 기록 재시도 중"을 보인다. 종료된 Run에서 `/steps`만 계속 실패하면 최대 5회(`임시`) 다시 조회한 뒤 멈추고 "단계 기록을 불러오지 못했습니다"와 재시도 버튼을 보인다. 테스트는 `tests/run-progress.test.tsx`다.
- `404`는 "실행을 찾을 수 없음"과 `/` 링크, 연속 실패는 `ErrorNotice`의 재시도 버튼, 재시도 중에는 "연결 재시도 중"을 보인다. 단계가 아직 없으면 "첫 단계 준비 중"을 보인다.

### 3. UX 탐색 분석 결과

- 화면은 위에서 아래로 실행 정보 카드(상태, 출처, 실행 ID, 버전, 실행 일시, 사용자 유형, 목표, 버전 비교 보기 링크), 요약 카드 3개(목표 달성, 탐색 단계, UX 검토 후보)와 접힌 전체 요약, AI 탐색 경로(노드 사이에 그 이동을 만든 행동), 단계별 탐색 상세(스크린샷과 의사결정 2단), UX 검토 후보 카드, 다른 실행 보기다.
- 요약(종료 상태, 목표 달성, 탐색 단계, CLICK·GO_BACK 횟수, 검토 후보 수)은 `Run.summary`를 그대로 쓴다.
- 탐색 경로의 노드는 `summary.path`(`PathVisit`)다. `PathVisit.stepId`는 그 노드에 **들어오게 만든** Step이다(시작 화면과 시스템 BACK은 `null`, `계약 §6.4`). 한 노드의 화면에서 모델이 판단한 Step은 **다음 노드의 `stepId`**(노드 사이 화살표의 `CLICK [후보 이름]`도 이 Step에서 가져온다)이므로, 노드를 고르면 다음 노드의 `stepId`로 Step·스크린샷·확률·지표를 찾는다. 다음 노드가 없거나(도착 화면) 그 `stepId`가 `null`이면 이미지 없이 표시한다. [OI-3](../operations/open_issue.md#oi-3)
- 모델 GO_BACK으로 돌아온 노드(`enteredBy = GO_BACK`)는 "이전 화면 복귀"로 구분한다. 선택한 Step의 스크린샷·후보 확률은 공용 뷰어와 `CandidateProbabilityList`를 쓰고, 지표 패널(`decision` 값, `null`은 "계산 불가")은 접힘이 기본이다.
- 결과 요약은 기준을 허용 경로·사이트 지도·기준 없음으로 표시한다. 사이트 지도는 최단 경로 대비 추가 단계와 우회 이동을 표시하고 허용 경로 이탈은 사용하지 않는다. 기준이 없으면 원인을 추정하지 않고 "계산 불가 (경로 기준 없음)"으로 표시한다. 기준이 있는 `extraSteps` 계열은 목표 미도달이면 "해당 없음", 도달 후 `null`이면 "계산 불가"다. 사이트 지도 응답은 [OI-10](../operations/open_issue.md#oi-10)의 임시 항목이다. `validity = INVALID`이면 "무효 처리된 실행"과 `invalidReason`을 보이고 `replacementRunId`가 있으면 그 Run의 결과 화면 링크를 둔다.
- "다른 실행 보기"는 `GET /api/runs?experimentKey=`의 목록이다. 조회에 실패해도 화면의 나머지는 동작한다.
- Issue 상세에서는 `relatedStepIds`를 선택해 해당 Step의 스크린샷과 후보 확률을 확인한다. 경로 노드에 나타나지 않는 화면 변화 없는 Step도 확인할 수 있다. Step 조회 실패 시 재시도한다. Issue의 `evidence`는 선택한 Step에 따라 바뀌지 않으며, 일부 값이 최초 관찰 기준임을 표시한다.
- Issue는 `GET /api/runs/{runId}/issues`의 서버 순서를 그대로 쓰고 프론트가 다시 정렬하지 않는다. `PENDING`이면 이 응답만 최대 5회 다시 조회하고 멈춘 뒤 수동 재시도 버튼을 보인다. `evidence` 키의 표시 이름은 `features/run-result/issueLabels.ts`의 상수이며 표에 없는 키는 키 이름 그대로 보인다(`임시`).
- Run이 종료 전이면 결과 대신 진행 화면(`/runs/:runId`) 링크를 보이고, `404`이면 "실행을 찾을 수 없습니다"와 새 분석 링크를 보인다.

### 4. 버전 비교

- `experimentKey` 하나로 비교 결과 전체를 받는다.
  - 비교 조건 일치 여부는 `conditionChecks`와 `conditionsMatched`다.
  - 시작 화면(`pageKey = home`) 후보 대응은 `screenComparisons`의 `candidateComparisons`다.
  - 화면 지표 비교는 `screenComparisons[].metrics`다.
  - 탐색 경로 비교는 `runComparison`의 `path`다.
  - Issue 비교는 `runComparison`의 `detectedIssueTypes`다.
- 후보 박스를 겹쳐 그릴 때는 `beforeRunId`·`afterRunId`의 `/steps`에서 `beforeStepId`·`afterStepId`에 해당하는 Step을 찾아 `bbox`와 스크린샷을 가져온다.
- 비교 계산과 Issue 판정은 하지 않는다([지표와 목표 판정](../contracts/metrics-and-goal.md)).
- 구현(`features/comparison/`): `ComparisonPage`가 비교 응답을 한 번 조회하고(폴링 없음, 오류 안내의 버튼으로만 다시 조회) `useRunSteps`로 `beforeRunId`·`afterRunId`의 `/steps`를 각각 받는다. `/steps` 조회가 실패해도 비교 값은 계속 표시하고 이미지 자리에 안내만 보인다.
- 오류 안내(`ComparisonError`)는 `error.code`로 구분한다. `RUN_NOT_FOUND`(잘못된 주소), `COMPARISON_NOT_READY`(기다리면 해결, 다시 확인 버튼), `COMPARISON_RUN_INVALID`(재분석 링크 `/?experimentKey=…`), `ANALYSIS_ERROR`(다시 시도). 그 밖의 오류는 `ErrorNotice`를 쓴다.
- `conditionsMatched = false`이면 `matched = false`인 `conditionChecks`를 서버 순서대로 보인다. `code` 값으로 분기하지 않는다.
- 화면별 카드는 `pageKey`마다 Before·After 스크린샷과 각 Run의 Step bbox를 따로 그린다. `beforeStepId`/`afterStepId`가 `null`이거나 Step을 못 찾으면 이미지 없이 안내를 보인다. 후보 대응 표는 `semanticKey` 순서 그대로이고 `deltaProbability`가 `null`이면 "계산 불가"로 보인다. 지표 표 펼침 여부는 카드의 화면 상태이며 기본은 접힘이다.
- `useRunBasis`는 비교 응답에 없는 경로 기준을 각 Run의 `GET /api/runs/{runId}`에서 읽는다. 조회 실패 시 기준은 미상으로 두고 비교 값은 계속 표시한다.
- Run 단위 비교(`RunComparison`)는 before/after를 나란히 보이고 증감을 만들지 않는다. 경로 지표 기준 행을 표시하며 사이트 지도 Run이 하나라도 있으면 우회 이동 행을 추가한다. 사이트 지도 Run의 기준 경로 이탈은 "사용 안 함"으로 표시한다. 양쪽이 모두 허용 경로 또는 모두 사이트 지도면 해당 기준의 지표 이름을 쓰고, 그 밖에는 중립 이름을 쓴다. Issue 유형은 "탐지됨 / 탐지되지 않음"이다.
- 한눈에 보기의 화면별 지표 표는 양쪽 기준을 알면 목표 경로 확률에 기준별 설명을 붙인다. 기준이 다르면 Before·After 설명을 각각 표시하고, 하나라도 조회하지 못하면 설명을 붙이지 않는다.
- 지표 표기: 엔트로피는 소수 둘째 자리(단위 없음), margin·확률은 `%`·`%p`, `null`은 "계산 불가"다(`features/comparison/format.ts`). 증감은 서버 값에 부호만 붙인다.
- 출처 배지(`OriginBadges`)는 `beforeResultOrigin`과 `afterResultOrigin`이 같으면 하나, 다르면 둘 다 보인다.

### 저장된 실측 결과 재생

- 진입은 새 UX 분석 화면의 "저장된 결과 보기" 링크이며 경로는 `/replay`다. 구현은 `features/replay/`다.
- `ReplayPage`가 고정 `experimentKey`(`constants.ts`의 `REPLAY_EXPERIMENT_KEY`)로 `GET /api/runs?experimentKey=`를 한 번 조회해 Run마다 진행·결과 화면 링크를 둔다. 새 API는 없고 `POST /api/runs` 등 Run을 만들거나 바꾸는 요청은 보내지 않는다. 조회 재시도 중에는 "연결 재시도 중"을 보인다.
- 같은 키의 비교 화면(`/comparisons/{experimentKey}`) 링크는 Before·After 각각 종료된 `VALID` Run이 목록에 있을 때만 보인다. Issue 분석 완료 여부는 목록에 없으므로 `COMPARISON_NOT_READY`는 비교 화면의 오류 안내가 맡는다.
- 재생 표시(`ReplayNotice`)는 `resultOrigin` 배지와 별개이며 원본 값은 그대로 표시한다. 진행·결과·비교 화면에서 `experimentKey`가 고정 키와 같을 때만 보이고, 화면의 모든 `resultOrigin`이 `LIVE`·`SAVED_MEASURED`이면 "저장된 실측 결과 재생", 하나라도 그 밖(`MOCK`)이면 "MOCK 재생 테스트"다.
- 고정 키 값은 [OI-7](../operations/open_issue.md#oi-7)의 임시 값이다. 서버 없는 시연은 P0에서 하지 않는다. 테스트는 `tests/replay.test.tsx`다.

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
    runs.ts, presets.ts, comparisons.ts, health.ts   # endpoint 함수, screenshotUrl
    dto/                   # 서버 응답 타입 (계약서 그대로)
  adapters/                # dto -> domain 변환
  domain/                  # types.ts(도메인 모델), runStatus.ts(isTerminalStatus)
  mocks/                   # MSW. browser.ts, store.ts, errors.ts, fixtures/(run, scenario, runResult, comparison), handlers/(endpoint별)
  features/
    new-analysis/, run-progress/, run-result/, comparison/, replay/   # 화면별. 라우트는 App.tsx
  shared/                  # Layout(상단 바·접이식 사이드바), SectionTitle(카드 제목 줄), RunGauge(탐색 진행 게이지), icons, ProbabilityGauge, SelectedAction, stepLabel, EngineStatus, ErrorNotice, ResultOriginBadge, useHealth
    screenshot/            # boxStyle.ts(좌표 변환), ScreenshotViewer, CandidateProbabilityList
    polling/               # poller.ts(간격·backoff 규칙), usePolling(범용 폴링 훅)
public/
  mock/screens/            # 목업 쇼핑몰을 찍은 mock 스크린샷 PNG({before,after}/{home,mypage,orders,support,refund}.png)
  mockServiceWorker.js     # MSW 생성 파일
```

화면 라우트는 `/`(새 UX 분석), `/runs/:runId`(AI 탐색 진행), `/runs/:runId/result`(분석 결과), `/comparisons/:experimentKey`(버전 비교), `/replay`(저장된 결과 재생)다. 경로는 프론트가 정한 값이며 계약서 대상이 아니다. 좌표 변환 함수, 폴링 훅 같은 화면 공용 코드는 `shared/` 아래에 둔다.

## 목업 쇼핑몰

`mock-pages/`는 mock 모드의 스크린샷 원본인 MORO MARKET 목업 쇼핑몰이다(홈·마이페이지·주문 내역·고객센터·환불 신청의 정적 HTML·CSS와 SVG 상품 이미지). 앱과는 별개의 디자인이고 개발 서버에서 `/mock-pages/home.html?v=before`(또는 `after`)로 볼 수 있다. `v`는 상단 메뉴 라벨(Before `이용정보` / After `주문·환불`)만 바꾼다.

- `npm run mock:shots`(`mock-pages/capture.mjs`)가 Chrome·Edge(`puppeteer-core`)로 1440×900 PNG를 `public/mock/screens/`에 찍는다. 이 PNG는 Git에 올리고, mock 스크린샷 API(`GET /api/runs/{runId}/screenshots/{stepId}`)가 그대로 돌려준다.
- 후보 박스 위치(`src/mocks/fixtures/scenario.ts`의 bbox)는 페이지의 `data-key` 요소와 같아야 한다. 스크립트가 찍은 뒤 두 값을 비교하고 1px 넘게 어긋나면 실패한다. 페이지 레이아웃이나 bbox를 바꾸면 `npm run mock:shots`를 다시 실행한다.

## 스타일

- 디자인 토큰은 `src/styles/tokens.css`의 CSS 변수(`--um-*`)이며 `src/index.css`가 가져온다. 색·간격·라운딩은 이 변수로만 참조하고 컴포넌트 CSS에 색 값을 새로 쓰지 않는다. 값의 출처는 Stitch 시안 v5의 `DESIGN.md`(팀 확정 전 안)이고 `devs7ud.io`의 느낌을 반영했다. 테마는 라이트 고정이며 다크 모드와 전환하지 않는다.
- 글꼴 변수는 `--font-sans`와 `--font-mono`다. `--font-sans`는 Inter(400·500·600·700, `@fontsource-variable/inter`)를 먼저 선언해 영문·숫자는 Inter, 한글은 Pretendard(`pretendard`)로 그려지고 폴백은 `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`다. ID·코드·배지는 `--font-mono`(JetBrains Mono 400·500·600, `@fontsource-variable/jetbrains-mono`)이고 `.mono`, `.badge-mono`로 쓴다. 모노 스택에 Pretendard를 끼워 배지 안 한글이 시스템 고정폭 글꼴로 떨어지지 않게 한다. 확률·단계·표 수치와 `.num`에는 `font-variant-numeric: tabular-nums`를 적용한다.
- 레이아웃은 떠 있는 알약형 상단 바와 접이식 사이드바 카드(`Layout`)다. 상단 바에 사이드바 토글·로고·현재 위치·새 분석 버튼이 있고, 사이드바의 펼침 여부는 `localStorage`(`um.sidebar.open`)에 저장한다. 사이드바 메뉴는 주소 인자 없이 열 수 있는 화면(새 UX 분석, 저장된 결과 재생)만 두고, 진행·결과·비교 화면은 화면 안의 링크로 들어간다. 767px 이하에서는 사이드바가 본문 위에 겹쳐 열리고 메뉴를 고르면 닫힌다.
- 정보 위계는 `index.css` 끝의 "정보 위계" 블록이 정한다. 글자는 `--um-text`(제목·값), `--um-text-secondary`(본문), `--um-text-muted`(라벨·보조 문구) 세 단계로 밝기를 나누고, 면은 따뜻한 회색 바닥(`canvas`) 위에 흰 카드(`surface`)가 그림자로 떠 있고, 카드 안 칸은 `surface-subtle`, 눌림·강조 칸은 `surface-raised`다. 모서리는 카드 24px·컨트롤 12px·버튼 알약형이다. 주 버튼은 잉크색(`--um-brand`), 링크·선택은 파랑(`--um-accent`), 한 화면의 핵심(현재 메뉴, 첫 결과 카드, 증감 칩, 단계 번호, 구역 제목 막대)은 노랑(`--um-highlight`)이다. 핵심 수치는 Before(`--um-before`)·After(`--um-after`) 색으로, 구역 제목은 왼쪽 accent 막대로 구분한다. 참고한 기준은 Material 3 color roles(surface container 단계, outline과 대비 기준 3:1·4.5:1)와 Linear의 "구조는 선이 아니라 명암으로" 원칙이다.
- 사이드바 너비는 `Layout`의 분할자(`role="separator"`)로 조절한다. 끌기, 방향키(±16px, Shift ±48px), `Home`/`End`(최소 200px·최대 420px), 두 번 누르면 기본 256px이고 값은 `localStorage`(`um.sidebar.width`)에 저장한다. 767px 이하에서는 조절하지 않는다.
- 기본 버튼은 보조 스타일이고, 화면의 주 행동(`분석 시작`, `비교하기`)에만 `primary`를 쓴다. `분석 결과 보기`는 링크이므로 `run-result-link` 클래스로 같은 모양을 내고, 종료 전 비활성 버튼은 기본 스타일이다.
- `[role='alert']`와 `.error-notice`는 오류 스타일이고 `.error-notice[role='status']`(예: 비교 준비 중)는 정보 스타일이다. `data-origin`(`LIVE`, `MOCK`, `SAVED_MEASURED`)과 `data-status`는 배지 색을 정한다. 색만으로 뜻을 전하지 않도록 배지에는 항상 글자를 함께 둔다.
- 모든 화면은 큰 제목(`page-header`: `h1`과 출처·재생 배지) 아래에 구역이 쌓인다. 구역은 두 종류다. 흰 카드(`card`, 24px 여백·그림자·제목 줄)와, 새 분석처럼 카드 없이 번호·세로선으로 여는 구역이다. 어느 쪽이든 줄글·배지·칩은 구역 안에 둔다. 카드 안쪽 여백은 `--um-card-pad`(24px, 좁은 화면 16px)로 같다. 정의 목록(`summary-grid`)은 라벨 열 너비(168px)가 모든 카드에서 같다.
- 라이트 면 위에서 글자는 본문 `#3d414d`, 흐린 글자 `#666a77`(흰 면 위 4.5:1 이상), 제목·값 `#14141a`를 쓰고, 입력 안내·비활성(`#8a8e99`)만 그보다 옅다. 본문은 14px/22px, 카드 제목은 15~20px이고 12px보다 작은 글자는 쓰지 않는다. 화면 제목(`h1`)은 28~48px 굵게(800)다.
- 라이트 고정이다. 다크 모드와 전환 기능을 만들지 않고 `tokens.css`는 `color-scheme: light`와 라이트 값만 둔다. 카드·사이드바·상단 바는 그림자(`--um-shadow-card`)와 옅은 1px 테두리로 떠 보이게 하고, 장식용 글로우는 쓰지 않는다. 진행 중임을 알리는 움직임(탐색 진행 게이지의 줄무늬, 상태 점)만 애니메이션을 쓰며 `prefers-reduced-motion`에서는 꺼진다.
- 확률은 `ProbabilityGauge`(0~100% 고정 눈금)로 보이고 옆에 숫자를 적는다. 구간별로 색을 바꾸지 않는다(좋고 나쁨의 판정처럼 보이지 않게). Before는 청록, After는 주황으로 서로 대비되는 색이고 눈금선(25% 간격)과 채움 끝 마감선이 있다.
- 스크린샷 위 후보 박스에는 윤곽선과 박스 바깥의 번호 태그만 올리고 확률 숫자는 올리지 않는다. 번호는 `CandidateProbabilityList`의 번호와 같고 확률은 그 목록에서 찾는다. 화면 맨 위에 붙은 박스는 태그를 박스 아래에 둔다. 비교 화면의 번호는 `candidateComparisons`의 행 순서를 기준으로 `semanticKey`가 같으면 두 버전에서 같다(`features/comparison/candidateNumbers.ts`).
- 버전 비교의 화면별 비교는 보기 방식을 전환한다. "한눈에 보기"(기본)는 화면마다 Before·After를 같은 비율로 줄여 나란히 놓고 후보별 Before/After 게이지와 서버 증감 값을 표로 보인다. "하나씩 보기"(`SingleScreenView`)는 화면과 버전을 골라 한 장씩 크게 보이고 후보 확률 게이지를 옆에 둔다. 보기 방식과 선택은 화면 상태다. 증감에는 부호만 붙이고 화살표나 좋고 나쁨을 뜻하는 색은 쓰지 않는다.
- 시안에 있어도 계약서·현재 API에 없는 요소(버전 추가 동작, 실행 이벤트 로그 등)는 동작하게 만들지 않는다. 분석 사이트 입력란은 [OI-8](../operations/open_issue.md#oi-8)의 임시 결정에 따라 입력만 받고 요청에는 싣지 않는다.
- 탐색 진행 게이지(`RunGauge`)는 최대 단계 수만큼 칸을 나누고 끝난 단계를 채운다. 진행 중이면 다음 칸이 줄무늬로 차오르고, 실행 대기(`READY`)이면 "탐색 시작 전"으로 칸을 비워 둔다. 종료되면 상태에 따라 초록(성공)·노랑(차단·최대 단계·시간 초과)·빨강(오류)이다. `progressbar` 역할로 값을 노출한다.
