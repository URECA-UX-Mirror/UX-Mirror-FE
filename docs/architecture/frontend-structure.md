# 프론트엔드 구조

## 실행 환경과 흐름

- 프론트(React + TypeScript + Vite, `http://localhost:5173`)는 FastAPI(`http://127.0.0.1:8000`)와만 통신한다. Zoro-1 GPU 서버와 쇼핑몰(8001·8002)에는 직접 접근하지 않는다.
- 흐름: 분석 조건 선택 → `POST /api/runs` → `runId` 수신 → 폴링으로 상태 조회 → 종료 후 단일 Run 결과 표시 → 두 Run 비교 조회.
- 데이터 계층은 `Project → Version → Run → Step`이다. 현재 P0 백엔드는 MORO MARKET의 Before/After(`variant`)만 다루므로 Version 관리는 `P1`이다.

## 화면별 사용 API

화면은 네 개다. 디자인·레이아웃은 이 문서 범위 밖이다.

| # | 화면 | 사용 API | 화면 상태(서버 데이터 아님) |
| --- | --- | --- | --- |
| 1 | 새 UX 분석 | `GET /api/presets`, `POST /api/runs` | 선택한 목표·사용자 유형·최대 탐색 횟수, 비교할 두 버전 선택 |
| 2 | AI 탐색 진행 | `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` | 열람 중인 stepId(기록 열람 / 최신), 후보 목록 펼침 |
| 3 | UX 탐색 분석 결과 | `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues` | 선택한 경로 노드, 열린 Issue 상세, 지표 패널 펼침 |
| 4 | 버전 비교 | `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}/screenshots/{stepId}` | 지표 표 펼침 |

### 1. 새 UX 분석

- 분석 대상은 MORO MARKET 프리셋만 지원한다. 프리셋과 일치하지 않는 주소는 입력 단계에서 막고 "지원하지 않는 웹사이트" 안내를 보인다. 검증 기준은 프리셋 응답의 사이트 정보이며 별도 API는 호출하지 않는다.
- 최대 탐색 횟수는 프리셋이 주는 범위(`임시`: 1~15, 기본 8)로 제한한다. [OI-15](../operations/open_issue.md#oi-15)
- 버전 표의 행은 `variant`(`before`, `after`)에 대응한다. 표시 이름 `v1 (변경 전)`, `v2 (변경 후)`는 프론트가 `variant`에서 만들고, "변경 내용"은 프리셋이 제공한다. 같은 조건의 두 실행은 하나의 `experimentKey`로 묶는다. [OI-2](../operations/open_issue.md#oi-2), [OI-9](../operations/open_issue.md#oi-9)
- 행의 "마지막 Run ID·분석 상태·목표 달성 상태"는 해당 variant의 최신 Run을 조회해 채운다. Run 목록 API가 정해지기 전에는 이 브라우저에서 시작한 Run의 `runId`를 `localStorage`에 기록해 대신한다(`임시`). [OI-8](../operations/open_issue.md#oi-8)
- `+ 버전 추가`와 `v3` 행은 `P1`이라 비활성으로 둔다.
- 비교 버튼은 두 버전의 Run이 모두 종료 상태일 때만 활성화하고 같은 버전을 두 번 고르면 오류를 보인다.

### 2. AI 탐색 진행

- `runId`를 URL에 담아 새로고침 뒤에도 같은 실행을 복원한다. 폴링 규칙은 [실행 상태와 폴링](../contracts/run-lifecycle.md)을 따른다.
- 탐색 화면은 스크린샷 위에 후보 bbox와 확률을 겹쳐 그린다([스크린샷과 bbox](../contracts/screenshot-bbox.md)). 열람 중인 단계가 최신이 아니면 "기록 열람 중" 안내와 최신 단계 이동 버튼을 보인다.
- 아직 실행되지 않은 단계(`currentStep` 이후)는 서버 데이터가 없으므로 `maxSteps`로 대기 칸을 만들어 보인다.
- "실행 이벤트 로그"와 "Playwright 상태"는 응답 필드가 정해지지 않았다. 필드가 없으면 해당 영역을 숨긴다. [OI-16](../operations/open_issue.md#oi-16)
- 분석 결과 보기는 Run이 종료 상태일 때만 활성화한다.

### 3. UX 탐색 분석 결과

- 요약(종료 상태, 목표 달성, 탐색 단계와 CLICK·GO_BACK 횟수, Issue 수)은 Run `summary`를 그대로 표시한다.
- 탐색 경로의 노드는 Step을 순서대로 나열한 것이며, 노드를 고르면 해당 단계의 스크린샷·확률·지표를 보인다.
- "다른 실행 보기"는 Run 목록이 필요하다. 정해지기 전에는 `localStorage` 기록을 쓴다. [OI-8](../operations/open_issue.md#oi-8)
- Issue는 "AI 탐색 기록 기반 검토 후보"로만 표기하고 실제 사용자 결함으로 단정하지 않는다.

### 4. 버전 비교

- `experimentKey` 하나로 비교 결과 전체를 받는다. 조건 일치 여부, 지표 표, 시작 화면 후보 대응, 경로 비교, Issue 비교를 모두 응답 값으로 그린다.
- 비교 계산과 Issue 판정은 하지 않는다([지표와 목표 판정](../contracts/metrics-and-goal.md)).

## 데이터 출처 구분

화면 오른쪽 위 배지는 `Run.resultOrigin`을 그대로 표시한다.

| 값 | 의미 |
| --- | --- |
| `MOCK` | 프론트 fixture. 백엔드와 무관한 예시 값 |
| `LIVE` | 이번 세션에서 백엔드가 실제로 실행한 결과 (`BE 확인`: 결과 파일에 `resultOrigin: "LIVE"` 기록) |
| `SAVED_MEASURED` | 이전에 실측해 저장한 결과를 다시 보여 주는 값. 시연 방식은 [OI-13](../operations/open_issue.md#oi-13) |

## 계층 분리 원칙

- 화면 컴포넌트는 `fetch`를 직접 호출하지 않고 도메인 모델만 받는다.
- 서버 응답 DTO와 프론트 도메인 모델을 분리하고, 변환은 Adapter 한 곳에서만 한다. 필드명·단위·null 규칙이 바뀌어도 Adapter만 고친다.
- 데이터 공급원(Mock / 실제 API)은 API 계층 안에서 교체하고 화면은 구분하지 않는다. Mock은 실제 응답 DTO와 같은 구조로 만든다.
- 서버 데이터(Run, Step, 비교 결과)와 화면 상태(선택한 단계, 펼침 여부)를 섞지 않는다.
- 값 변환(확률 ×100, 소수점 반올림, 날짜 표기)은 표시 단계에서만 하고 원본 값은 보존한다.

## 폴더 구조(제안, 아직 생성하지 않음)

```
src/
  config/env.ts            # VITE_API_BASE_URL 등 환경변수 한 곳에서 읽기
  api/
    client.ts              # fetch 래퍼, 오류 변환
    runs.ts, presets.ts, comparisons.ts
    dto/                   # 서버 응답 타입 (계약 그대로)
  adapters/                # dto -> domain 변환
  domain/                  # Run, Step, Candidate, Issue, Comparison
  mocks/                   # 응답 DTO 형식의 fixture
  features/
    new-analysis/, run-progress/, run-result/, comparison/
  shared/                  # 공용 컴포넌트, 포맷터, 폴링 훅
```
