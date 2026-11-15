# REST API 임시 계약

이 문서는 프론트가 필요로 하는 요청·응답을 정리한 **프론트엔드 임시 계약**이다. `UX-Mirror-BE`에는 아직 FastAPI endpoint 코드가 없어 모든 형식이 `임시`이며, 백엔드 계약이 생기면 그쪽이 정본이다. 타입은 [데이터 모델](data-model.md), 상태값은 [실행 상태와 폴링](run-lifecycle.md)에 있다.

## 공통 규칙 (`임시`)

- Base URL은 `VITE_API_BASE_URL`이다. 요청·응답 본문은 JSON(UTF-8)이고 스크린샷만 이미지다.
- 필드명은 camelCase, 시각은 ISO 8601 문자열, 확률은 0~1 소수다. `null`은 "값이 없음"을 뜻한다.
- 인증은 없다. 비밀값은 요청에 싣지 않는다.
- 범위: 아래 endpoint는 모두 `P0`(MORO MARKET Before/After)다.

### 상태 코드와 오류 (`임시`, [OI-4](../operations/open_issue.md#oi-4))

| 코드 | 의미 | 프론트 처리 |
| --- | --- | --- |
| 200 | 성공 | 정상 표시 |
| 202 | 실행 접수(`POST /api/runs`) | `runId`로 진행 화면 이동 |
| 400 | 요청 값 오류 | 입력 화면에서 메시지 표시 |
| 404 | 대상 없음(Run·Step·비교 대상) | 대상별 빈 상태 표시 |
| 409 | 현재 상태에서 처리 불가(동시 실행 제한 등) | 재시도 안내 |
| 422 | FastAPI 기본 검증 오류(`detail` 배열) | 입력 오류로 처리 |
| 5xx | 서버 오류 | 오류 안내와 재시도 |

오류 본문은 `{ "error": { "code": string, "message": string } }`로 가정하고, 형식이 다르면 Adapter에서 변환한다. 프론트는 `code`가 있으면 코드로 분기하고 없으면 HTTP 상태 코드로 분기한다.

## GET /api/presets — 화면 1

선택 가능한 사이트·목표·사용자 유형·모델·버전과 입력 제한을 반환한다. 요청 파라미터는 없다. [OI-15](../operations/open_issue.md#oi-15)

```ts
interface PresetsResponse {
  sites: { siteId: string; label: string; baseUrl: string }[];         // baseUrl: 주소 검증용
  goals: { goalId: string; label: string }[];                          // goalId 예: "refund" (BE 확인)
  personas: { personaId: string; label: string }[];
  models: { modelId: string; label: string }[];
  variants: { variant: "before" | "after"; label: string; change: string }[]; // change: "메뉴 라벨: 이용정보"
  limits: { maxStepsMin: number; maxStepsMax: number; maxStepsDefault: number };
}
```

예시(임시):

```json
{
  "sites": [{ "siteId": "moro-market", "label": "MORO MARKET", "baseUrl": "http://127.0.0.1:8001" }],
  "goals": [{ "goalId": "refund", "label": "최근 구매한 상품의 환불 신청 화면 찾기" }],
  "personas": [{ "personaId": "novice-shopper", "label": "온라인 쇼핑 경험이 적고 환불 절차에 익숙하지 않은 사용자" }],
  "models": [{ "modelId": "zoro-1-direct-typed", "label": "Zoro-1 Direct Typed Decision choice" }],
  "variants": [
    { "variant": "before", "label": "v1 (변경 전)", "change": "메뉴 라벨: 이용정보" },
    { "variant": "after", "label": "v2 (변경 후)", "change": "메뉴 라벨: 주문·환불" }
  ],
  "limits": { "maxStepsMin": 1, "maxStepsMax": 15, "maxStepsDefault": 8 }
}
```

빈 데이터: `sites`가 비어 있으면 분석을 시작할 수 없으므로 시작 버튼을 비활성화하고 안내를 보인다. 실패하면 오류 안내와 재시도를 제공한다.

## POST /api/runs — 화면 1

분석 실행을 시작하고 `runId`를 즉시 반환한다. 실행은 비동기로 진행되며 방식은 프론트가 가정하지 않는다.

```ts
interface CreateRunRequest {
  siteId: string;
  goalId: string;
  personaId: string;
  modelId: string;
  variant: "before" | "after";
  maxSteps: number;          // limits 범위 안의 정수
  experimentKey?: string;    // 같은 실험의 두 번째 Run일 때만 전달
}
interface CreateRunResponse {
  runId: string;
  experimentKey: string;     // 요청에 없으면 서버가 발급
  status: RunStatus;
}
```

- 필수: `siteId`, `goalId`, `personaId`, `modelId`, `variant`, `maxSteps`. 선택: `experimentKey`. [OI-1](../operations/open_issue.md#oi-1), [OI-2](../operations/open_issue.md#oi-2)
- 응답 202. 400·422는 입력 오류, 409는 동시 실행 제한. [OI-5](../operations/open_issue.md#oi-5)
- 같은 조건 비교를 위해 `goalId`·`personaId`·`modelId`·`maxSteps`는 Before/After에서 같아야 한다. 프론트는 첫 Run의 조건을 두 번째 Run에 그대로 재사용한다.

## GET /api/runs/{runId} — 화면 2, 3

실행 상태와 요약을 반환한다. 폴링 대상이다.

- Path: `runId`. Query: 없음. 응답: `Run`([데이터 모델](data-model.md#run)).
- 404: `runId`를 서버가 모름. 새로고침 뒤 복원 중이면 "실행을 찾을 수 없음" 화면과 새 분석 이동을 제공한다.
- 실행 중에는 `finishedAt`, `terminationReason`, `summary.goalReached`가 `null`일 수 있다.

## GET /api/runs/{runId}/steps — 화면 2, 3

단계별 탐색 기록을 시간 순서(`stepIndex` 오름차순)로 반환한다.

- Path: `runId`. Query: 없음(`임시`). 응답: `{ runId: string; steps: Step[] }`.
- 빈 데이터: 실행 시작 직후에는 `steps`가 빈 배열이다(200). 프론트는 "첫 단계 준비 중"을 보인다.
- 404는 `runId`가 없을 때만 쓴다.
- 실행 중에는 마지막 Step이 `DECIDING`·`EXECUTING`일 수 있고 같은 `stepId`의 내용이 갱신된다. 프론트는 `stepId` 기준으로 덮어쓴다.

## GET /api/runs/{runId}/screenshots/{stepId} — 화면 2, 3, 4

해당 단계에서 Playwright가 캡처한 **원본 화면**(후보 박스·확률 배지 없음)을 `image/png`로 반환한다. 제공 방식과 이미지 크기는 [스크린샷과 bbox](screenshot-bbox.md)와 [OI-6](../operations/open_issue.md#oi-6)에 있다.

- 404: 아직 캡처되지 않았거나 없는 `stepId`. 프론트는 이미지 영역에 "화면 준비 중" 자리표시를 보이고, 실행이 끝났는데도 404면 "화면 없음"으로 바꾼다.
- 프론트는 `Step.screenshot.imageUrl`이 있으면 그 값을, 없으면 이 경로를 `VITE_API_BASE_URL`에 붙여 사용한다.

## GET /api/runs/{runId}/issues — 화면 3

규칙 기반 UX 검토 후보를 반환한다. Issue는 AI 탐색 기록에서 뽑은 검토 대상이며 실제 사용자 결함이 아니다.

- 응답: `{ runId: string; ready: boolean; items: Issue[] }`.
- `ready=false`이면 Run이 아직 종료되지 않아 판정 전이다(200, `items`는 빈 배열). `ready=true`이고 `items`가 비어 있으면 "검토 후보 0건"이다. 두 경우를 구분해 표시한다.
- 정렬은 서버 순서를 따르고 프론트가 다시 정렬하지 않는다. [OI-10](../operations/open_issue.md#oi-10)

## GET /api/comparisons/{experimentKey} — 화면 4

같은 `experimentKey`의 Before/After Run을 비교한 결과를 반환한다.

- Path: `experimentKey`. Query: 없음. 응답: `Comparison`([데이터 모델](data-model.md#comparison)).
- 200 + `conditionsMatched=false`: 두 Run은 있으나 조건이 달라 비교할 수 없는 경우. `mismatchReasons`를 표시하고 지표는 `null`로 둔다. [OI-11](../operations/open_issue.md#oi-11)
- 404: `experimentKey`가 없거나 두 Run 중 하나가 아직 종료되지 않음. "두 버전의 분석이 모두 끝나면 비교할 수 있습니다" 안내를 보인다.

## P1 (구현된 기능이 아님)

- 새 버전 등록, 다중 버전 관리, 같은 버전의 여러 Run 선택, 임의 두 버전 비교, 전체 버전 변화 추적. 이 기능은 위 endpoint에 포함되지 않았고 별도 계약이 필요하다.
- Run 목록 조회 API는 `P0` 필요 여부를 검토 중이다. [OI-8](../operations/open_issue.md#oi-8)
