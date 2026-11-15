# 프론트엔드 구조

## 실행 환경과 흐름

- 프론트(React + TypeScript + Vite, `http://localhost:5173`)는 FastAPI(`http://127.0.0.1:8000`)와만 통신한다. Zoro-1 GPU 서버와 쇼핑몰(8001·8002)에는 직접 접근하지 않는다.
- 흐름: 분석 조건 선택 → `POST /api/runs` → `runId` 수신 → 폴링으로 상태 조회 → 종료 후 단일 Run 결과 표시 → 두 Run 비교 조회.
- 장기 데이터 계층은 `Project → Version → Run → Step`이다. P0 백엔드는 MORO MARKET의 Before/After(`variant`)만 다루므로 Version 관리는 `P1`이다.
- API와 타입의 정본은 계약서다([문서 목차](../README.md)). 이 문서는 화면별 사용처와 표시 규칙만 정한다.

## 화면별 사용 API

화면은 네 개다. 디자인·레이아웃은 이 문서 범위 밖이다.

| # | 화면 | 사용 API | 화면 상태(서버 데이터 아님) |
| --- | --- | --- | --- |
| 1 | 새 UX 분석 | `GET /api/presets`, `GET /api/health`, `POST /api/runs` | 선택한 목표·사용자 유형·최대 탐색 횟수, 비교할 두 버전 선택 |
| 2 | AI 탐색 진행 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` | 열람 중인 stepId(기록 열람 / 최신), 후보 목록 펼침 |
| 3 | UX 탐색 분석 결과 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues` | 선택한 경로 노드, 열린 Issue 상세, 지표 패널 펼침 |
| 4 | 버전 비교 | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` | 지표 표 펼침 |

`GET /api/health`는 모든 화면의 공통 영역(엔진 상태 표시)에서 호출한다. 화면 1에서는 시작 가능 여부 판단에도 쓴다. 화면 4는 `CandidateComparison`에 `bbox`가 없으므로 `beforeRunId`·`afterRunId`의 `/steps`에서 해당 Step을 가져온다.

### 1. 새 UX 분석

- 사이트(MORO MARKET)·버전 이름·변경 내용·최대 탐색 횟수 범위(1~15, 기본 8)는 프리셋 응답에 없으므로 프론트 상수다. 목표·사용자 유형은 `GET /api/presets`에서 받는다. [OI-6](../operations/open_issue.md#oi-6)
- 프리셋과 일치하지 않는 주소는 입력 단계에서 막고 "지원하지 않는 웹사이트" 안내를 보인다. 검증은 상수 기준이며 별도 API는 호출하지 않는다.
- 버전 표의 행은 `variant`(`before`, `after`)에 대응한다. 표시 이름은 `v1 (변경 전)`, `v2 (변경 후)`다. 두 Run은 같은 `experimentKey`로 묶고 `goalId`·`personaId`·`maxSteps`를 같게 보낸다.
- 행의 "마지막 Run ID·분석 상태·목표 달성 상태"는 해당 variant의 최신 Run으로 채운다. Run 목록 API가 없으므로 이 브라우저에서 시작한 `runId`를 `localStorage`에 기록해 대신한다. [OI-2](../operations/open_issue.md#oi-2)
- `+ 버전 추가`와 `v3` 행은 `P1`이라 비활성으로 둔다.
- 비교 버튼은 두 버전의 Run이 모두 종료 상태일 때만 활성화하고, 같은 버전을 두 번 고르면 오류를 보인다.
- 엔진 상태는 `GET /api/health`로 표시한다. `activeRun`이 있으면 새 분석 시작을 막는다.

### 2. AI 탐색 진행

- `runId`를 URL에 담아 새로고침 뒤에도 복원한다. 폴링 규칙은 [실행 상태와 폴링](../contracts/run-lifecycle.md)을 따른다.
- 탐색 화면은 원본 스크린샷 위에 후보 bbox와 확률을 겹쳐 그린다([스크린샷과 bbox](../contracts/screenshot-bbox.md)). 열람 중인 단계가 최신이 아니면 "기록 열람 중" 안내와 최신 단계 이동 버튼을 보인다.
- 아직 실행되지 않은 단계는 서버 데이터가 없으므로 `maxSteps`로 대기 칸을 만든다. 진행도는 `Run.progress`를 쓴다.
- 실행 이벤트 로그와 Playwright 상태는 `/events`가 `P1`이라 표시하지 않는다.
- 분석 결과 보기는 Run이 종료 상태일 때만 활성화한다.

### 3. UX 탐색 분석 결과

- 요약(종료 상태, 목표 달성, 탐색 단계, CLICK·GO_BACK 횟수, 검토 후보 수)은 `Run.summary`를 그대로 쓴다.
- 탐색 경로의 노드는 `summary.path`(`PathVisit`)다. 노드에 `stepId`가 있으면 해당 Step의 스크린샷·확률·지표를 보인다. `stepId`가 `null`인 노드(시작 화면, 시스템 BACK)와 도착 화면은 이미지 없이 표시한다. [OI-3](../operations/open_issue.md#oi-3)
- "다른 실행 보기"는 Run 목록이 필요하다. 정해지기 전에는 `localStorage` 기록을 쓴다. [OI-2](../operations/open_issue.md#oi-2)
- Issue는 `GET /api/runs/{runId}/issues`의 서버 순서를 그대로 쓰고 프론트가 다시 정렬하지 않는다.

### 4. 버전 비교

- `experimentKey` 하나로 비교 결과 전체를 받는다.
  - 비교 조건 일치 여부는 `conditionChecks`와 `conditionsMatched`다.
  - 시작 화면(`pageKey = home`) 후보 대응은 `screenComparisons`의 `candidateComparisons`다.
  - 화면 지표 비교는 `screenComparisons[].metrics`다.
  - 탐색 경로 비교는 `runComparison`의 `path`다.
  - Issue 비교는 `runComparison`의 `detectedIssueTypes`다.
- 후보 박스를 겹쳐 그릴 때는 `beforeRunId`·`afterRunId`의 `/steps`에서 `beforeStepId`·`afterStepId`에 해당하는 Step을 찾아 `bbox`와 스크린샷을 가져온다.
- 비교 계산과 Issue 판정은 하지 않는다([지표와 목표 판정](../contracts/metrics-and-goal.md)).

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
| 확률 | "모델의 선택 확률이며 실제 사용자의 클릭 확률이 아니다" 문구를 함께 둔다 |
| Run 표기 | `runId`를 그대로 표시한다 |

## 데이터 출처 구분

화면 오른쪽 위 배지는 `resultOrigin`을 그대로 표시한다(`계약 §2.1`). 비교 화면은 `beforeResultOrigin`·`afterResultOrigin`이 다르면 두 값을 모두 표시한다.

| 값 | 의미 |
| --- | --- |
| `LIVE` | 현재 실행에서 실제 Zoro-1을 호출해 얻은 결과 |
| `MOCK` | 테스트를 위해 고정하거나 생성한 모델 응답. 백엔드의 Mock 실행과 프론트 fixture가 모두 이 값을 쓴다 |
| `SAVED_MEASURED` | 과거 실제 호출 결과를 저장한 뒤 재생한 결과. 시연 방법은 [OI-7](../operations/open_issue.md#oi-7) |

## 계층 분리 원칙

- 화면 컴포넌트는 `fetch`를 직접 호출하지 않고 도메인 모델만 받는다.
- 서버 응답 DTO와 프론트 도메인 모델을 분리하고, 변환은 Adapter 한 곳에서만 한다. 필드명·단위·null 규칙이 바뀌어도 Adapter만 고친다.
- 데이터 공급원(Mock / 실제 API)은 API 계층 안에서 교체하고 화면은 구분하지 않는다. fixture는 실제 응답 DTO와 같은 구조로 만들고 `resultOrigin`을 `MOCK`으로 둔다.
- 서버 데이터(Run, Step, 비교 결과)와 화면 상태(선택한 단계, 펼침 여부)를 섞지 않는다.
- 값 변환(확률 ×100, 소수점 반올림, 날짜 표기)은 표시 단계에서만 하고 원본 값은 보존한다.

## 폴더 구조(제안, 아직 생성하지 않음)

```
src/
  config/env.ts            # VITE_API_BASE_URL 등 환경변수 한 곳에서 읽기
  api/
    client.ts              # fetch 래퍼, ErrorDetail 변환
    runs.ts, presets.ts, comparisons.ts, health.ts
    dto/                   # 서버 응답 타입 (계약서 그대로)
  adapters/                # dto -> domain 변환
  domain/                  # Run, Step, Candidate, Issue, Comparison
  mocks/                   # 응답 DTO 형식의 fixture
  features/
    new-analysis/, run-progress/, run-result/, comparison/
  shared/                  # 공용 컴포넌트, 포맷터, 폴링 훅
```
