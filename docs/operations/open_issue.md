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
| [OI-3](#oi-3) | 도착 화면 스크린샷 조회 | 정자비, 장근창 | 이미지 없이 표시 | 별도 API `GET /api/runs/{runId}/screenshots/goal`(UX-Mirror-BE #56) |
| [OI-8](#oi-8) | 분석 대상 사이트 입력 | 장근창 | 입력란은 두되 요청에 싣지 않고, MORO MARKET 외 값은 안내 후 시작을 막음 | (장근창 담당) |
| [OI-7](#oi-7) | 저장된 실측 데이터 시연 | 정자비 | `/replay`에서 원본 `LIVE` Run을 조회해 재생, 서버 없는 시연은 P0 제외 | 임시 결정대로. 고정 키는 11/19 E 실행 후 전달 |
| [OI-9](#oi-9) | 목표·사용자 유형 직접 입력 | 정자비, 장근창 | 백엔드 구현 기준으로 요청·표시, 실행 전 검사는 미구현 설계 | 화면 글자 사전 검사는 행사 뒤로. 도착 경로 없음 `422`·지도 오류 처리는 구현됨 |
| [OI-10](#oi-10) | 경로 지표 기준(basis)·우회 이동 | 정자비, 장근창 | 설계 v2.1 기준으로 optional로 받고, 없으면 `ALLOWED_PATHS`·`detourMoveCount: null` | 대부분 서버와 일치. ⚠️ 2건 다름(`referencePathConfig` 필드 없음 처리·mock `goalPathProbability`) |

## 항목

<a id="oi-3"></a>
### OI-3 도착 화면 스크린샷 조회

- 계약서: 목표 화면에 도착만 하고 모델 판단을 하지 않은 화면은 Step이 없고(`§15.3`), 스크린샷 API는 `stepId` 기준이다(`§17.7`).
- 경로의 마지막 노드(환불 신청 화면)의 이미지를 가져올 방법이 없다. 백엔드 실행 API는 이 항목을 범위에서 제외했다.
- 임시 결정: 해당 노드에 "도착 화면 이미지 없음"을 표시한다.
- 확인할 것: 도착 화면 이미지를 저장할지, 저장한다면 `PathVisit`에 참조를 둘지 별도 endpoint를 둘지. 저장 구조(정자비)가 정해진 뒤 결정하고, API는 별도 endpoint 또는 기존 스크린샷 API 확장으로 제공될 예정이다.
- 2번 답변 (11-18): **별도 endpoint로 결정.**
  - 저장: 이미 저장 중이다. 도착 시 루프가 사진을 찍어 `GOAL_REACHED` Event의 `details.screenshotRef`에 기록한다. 파일은 `screenshots/{마지막 stepId + 1}.png`라 `stepId` 스크린샷 API로는 `404`다. `PathVisit`은 바꾸지 않는다.
  - API: `GET /api/runs/{runId}/screenshots/goal` → `image/png`. 도착하지 않았거나 사진이 없으면 `404 RUN_NOT_FOUND` (UX-Mirror-BE #56, 리뷰 중).
  - FE: `terminationReason`이 `GOAL_VERIFIED`인 Run만 호출하고, `404`면 지금처럼 "도착 화면 이미지 없음"을 표시한다.
  - 남은 것: #56 머지, 계약 v1.3.7 반영.
- 담당: 정자비(저장), 장근창(API).

<a id="oi-7"></a>
### OI-7 저장된 실측 데이터 시연

- 계약서: `SAVED_MEASURED`는 과거 실제 호출 결과를 저장한 뒤 재생한 결과다(`§2.1`).
- 백엔드 결정: P0에서는 `SAVED_MEASURED` Run을 만들지 않는다. 시연은 원본 `LIVE` Run을 기존 조회 API(`GET /api/runs`, `/api/runs/{runId}`, `/steps`, `/screenshots`, `/api/comparisons/{experimentKey}`)로 읽기만 해서 재생한다. 새 API는 없고 원본 데이터의 `resultOrigin`은 `LIVE` 그대로다. 복사본이 필요하면 별도 `runId`·`experimentKey`로 복사하고 복사본만 `SAVED_MEASURED`로 저장한다.
- 시연 Run 고정: 백엔드 `results/final_execution_plan.json`의 `experimentKey`로 고정한다(제안). 재생 중 `LIVE` 실행은 다른 `experimentKey`로만 하며, 같은 키에 `VALID` Run이 있으면 `409 EXPERIMENT_RUN_EXISTS`로 원본이 보호된다.
- 임시 결정: 재생 모드는 `/replay`에서 고정 `experimentKey`의 Run 목록을 읽어 기존 화면으로 연결한다. 고정 키는 `src/features/replay/constants.ts`의 `REPLAY_EXPERIMENTS`(여러 키 목록, E 실행 목표별 환불·주문·고객센터)이며 지금은 mock 시드 `mock-done` 하나뿐인 **임시 값**이다. 서버 없는 시연(정적 결과 파일 읽기)은 P0에서 하지 않는다. 기획안이 복잡한 리플레이를 P0 밖에 두고 이 요구를 찾지 못했기 때문이다.
- 확인할 것: 고정할 실제 `experimentKey` 값(정자비). 받으면 상수를 바꾼다. "서버가 꺼져도 시연 가능"(역할 분담 5번 완료 기준)을 P0에 넣을지는 기획 확인 후 최종 결정한다.
- 2번 답변 (11-18): **임시 결정대로 한다.** 원본 `LIVE` Run을 기존 조회 API로 재생하고 `SAVED_MEASURED` 복사본은 만들지 않는다. 서버 없는 시연은 P0에서 제외한다. 고정 키는 11/19 E 실행 후 `results/final_execution_plan.json`의 `experimentKey`를 전달하며, 상수 교체는 #34에서 한다.
- 담당: 정자비.

<a id="oi-8"></a>
### OI-8 분석 대상 사이트 입력

- 계약서: `POST /api/runs` 요청 본문은 `experimentKey`, `variant`, `goalId`, `personaId`, `maxSteps`다. 사이트(주소)를 받는 필드는 없고 대상은 `variant`에 따라 백엔드가 정한다.
- 임시 결정: 새 UX 분석 화면의 "분석 사이트"를 입력할 수 있게 두되 값은 요청에 싣지 않는다. 입력값이 MORO MARKET(대소문자·앞뒤 공백 무시)이 아니거나 비어 있으면 안내를 보이고 분석 시작을 막는다. 입력한 대상과 실제 분석 대상이 달라지지 않게 하기 위해서다.
- 확인할 것: 임의 사이트를 분석할지, 요청 필드(예: 사이트 주소·버전별 주소)와 검증 규칙을 어떻게 둘지. 확정되면 계약서를 고치고 입력값을 요청에 싣는다.
- 담당: 장근창(API).

<a id="oi-9"></a>
### OI-9 목표·사용자 유형 직접 입력

- 상태: 백엔드 구현은 끝났다(UX-Mirror-BE #39·#42·#44). 요청·응답·비교 동작은 [REST API](../contracts/rest-api.md)와 [데이터 모델](../contracts/data-model.md)로 옮겼고, 이 항목에는 계약서에 아직 반영되지 않은 부분만 남긴다.
- 계약서(v1.3.5): `POST /api/runs`는 `goalId`·`personaId`만 받는다(`§5.1`, `§17.2`). 직접 입력 필드, Run `verification`, 비교 조건 변경은 계약 v1.3.6(초안)에 있다.
- 임시 결정: 프론트는 백엔드 구현 기준으로 요청을 보내고 표시한다. 직접 입력 목표의 사이트 지도 기준은 [OI-10](#oi-10)을 따른다. 성공 조건의 도착 화면은 서버가 실제 화면의 글자를 사전 검사하지 않으므로 화면에서 목록으로 고른다.
- 미구현 설계(v2.1): 실행 전 지원 도착 화면과 Before·After의 성공 조건 글자를 검사한다. 화면을 읽었으나 글자가 없으면 `422`, 화면을 읽지 못하면 재시도 가능한 `503 BROWSER_ERROR`로 Run을 만들지 않는다. 완성된 지도에서 도착 경로가 없을 때 `422`를 반환하는 검사는 백엔드에 반영됐다. 지도 오류 처리는 [OI-10](#oi-10)을 따른다. 화면을 열어 글자를 확인하는 사전 검사는 아직 실행 경로에 없다.
- 확인할 것: 계약 v1.3.6이 확정되면 `docs/contracts/`를 고친다. 글자 없음과 화면 확인 실패의 오류 코드·메시지 및 실제 구현을 백엔드와 확인한다. 백엔드 구현과 계약 확정 후 반영하고 미결정 사항이 모두 해소되면 이 항목을 지운다.
- 2번 답변 (11-18): **화면을 열어 글자를 확인하는 사전 검사(`422`·`503 BROWSER_ERROR`)는 행사 뒤로 미룬다.** E 실행 전 코드를 바꾸면 발표 수치에 영향이 있기 때문이다. 구현된 것은 두 가지다.
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
| `basis`가 없는 설정, `referencePathConfig` 필드가 없는 과거 Run을 어떻게 읽을지 | 둘 다 `ALLOWED_PATHS`로 읽고, 명시적 `null`만 기준 없음으로 본다 | 설계 4.1 | 서버가 같은 규칙으로 보내는지 | ⚠️ **다름.** `basis` 없음 → `ALLOWED_PATHS`, 설정 `null` → 기준 없음은 같다. `referencePathConfig` **필드 자체가 없으면** 서버는 "누락"으로 보고 기준 없음으로 처리한다(`uxm/reference.py`). API Run은 항상 이 필드를 쓴다(preset = ALLOWED_PATHS, 직접 입력 = SITE_MAP 또는 `null`) → FE도 필드 없음을 기준 없음으로 |
| `detourMoveCount`가 없을 때의 값 | `null`로 읽고 0으로 바꾸지 않는다 | 근거 없음, 임시 | 허용 경로 기준 Run에서도 필드를 주는지, `null`을 주는지 | 일치. ALLOWED_PATHS·기준 없음 Run은 필드를 주고 값은 `null`. UX-Mirror-BE #52 이전 Run은 필드가 없다 |
| 목표 미도달(`MAX_STEPS` 등) Run의 `detourMoveCount` | mock은 이동 기록으로 계산한다. 정의에 목표 도달 여부가 없고 `extraSteps`와 달리 최단 경로 비교가 필요 없기 때문이다 | 설계 3.1(미도달 정책은 근거 없음) | 미도달이면 `null`인지, 이동 기록으로 계산하는지 | 일치. 지도 밖으로 나가지 않았으면 도달 여부와 무관하게 이동 기록으로 계산 |
| SITE_MAP 설정 필드 | `siteMapVersion`·`siteMapHash`·`startPageKey`·`goalPageKey`·`shortestSteps`·`distances`(도달 불가 화면은 `null`)로 읽고 화면에는 쓰지 않는다 | 설계 4.1 | 실제 응답의 필드명·`null` 표현 | 일치. `basis: "SITE_MAP"` + 왼쪽 필드, `distances`의 도달 불가 화면은 `null` |
| SITE_MAP 기준의 `referencePathDeviationCount` | 이탈 횟수는 허용 경로 개념이라 mock은 `null`로 둔다 | 근거 없음, 임시 | 서버가 `null`을 주는지, 다른 정의를 쓰는지 | 일치. SITE_MAP·기준 없음이면 `null` |
| 기준별 `goalPathProbability` | 기존 ALLOWED_PATHS는 해당 후보가 없으면 `null`이다. SITE_MAP 설계는 모든 CLICK 후보의 목적지 거리를 확인하고 거리 감소 후보가 없으면 `0`, 하나라도 모르면 부분합 없이 `null`이다. mock은 거리 감소 후보를 합산한다 | 계약 §12.3, 설계 3.1·3.2 | 서버가 기준별 `null`·`0`과 부분합 금지를 따르는지, mock 반영이 필요한지 | ⚠️ **서버는 설계대로**(감소 후보 없음 `0`, 현재 화면·후보 하나라도 지도에 없으면 `null`, 부분합 금지). 비교에서 지도 검증 실패 시 `null`. → mock에 `0`·`null` 규칙 반영 필요 |
| SITE_MAP 추가 단계 지표 | 설계상 `extraSteps`·`extraNavigationCost`·`attemptedExtraSteps`는 지도상 최단 거리 기준이며 계산 불가 시 `null`이다. 지도 밖 화면으로 이동하면 `extraSteps`와 `detourMoveCount`는 `null`이다 | 설계 3.2·4.2 | 서버와 비교 응답 `RunOutcome`의 계산·null 조건 및 기준별 표시 방식 | 일치. 세 지표는 도착 + 지도 안일 때만 값. 지도 밖 이동 시 세 지표와 `detourMoveCount` 모두 `null`. 비교 `runComparison`도 지도 검증 실패 시 `extraSteps`·`extraNavigationCost`·`referencePathDeviationCount`·`detourMoveCount`를 `null`로 |
| 지도 오류 | 설계상 지도 없음·검증 실패·Run 조건 불일치 시 실행은 허용하고 `referencePathConfig`와 경로 지표는 `null`이다 | 설계 3.2 | 서버의 지도 오류 처리 및 응답 형식 | 일치. 단, 지도는 정상인데 도착 경로가 없으면 실행 전 `422` ([OI-9](#oi-9)) |
| 직접 입력한 목표의 SITE_MAP 적용 | 백엔드가 직접 입력 목표에 SITE_MAP 설정을 저장하며 mock도 `goalId`가 `null`이어도 SITE_MAP을 유지한다 | UX-Mirror-BE #50 | 실제 Run 통합 결과와 계약 확정 | UX-Mirror-BE #51 머지. 실제 쇼핑몰 통합 확인은 아직 |
| 결과 화면의 `null` 기준 구분 | `referenceBasis`가 `null`이면 원인(허용 경로 없음·지도 오류)을 응답에서 알 수 없어 "계산 불가 (경로 기준 없음)"으로만 표시하고 `goalId` 등으로 추정하지 않는다 | 근거 없음, 임시 | 응답에 기준 없음의 원인을 구분하는 값을 줄지 | 원인 값은 주지 않는다. P0는 "계산 불가 (경로 기준 없음)" 하나로 유지 |
| 우회 이동의 정의 | BACK을 뺀 모델 CLICK 이동 중 `d(이동 후) >= d(이동 전)`인 횟수로 mock을 만든다 | 설계 3.1 | 서버 계산과 일치하는지 | 일치. `null` 거리는 무한대로 본다 |

- 2번 답변 (11-18): 서버 Run에는 `referenceBasis` 필드가 없고, FE Adapter(`toReferenceBasis`)가 `referencePathConfig`에서 만든다. 이 변환은 서버 규칙과 같지만, 필드가 없을 때(`undefined`)만 `ALLOWED_PATHS`로 읽어 서버(기준 없음)와 다르다. 서버와 다른 FE 동작 2건(필드 없음 처리, mock `goalPathProbability`)은 별도 이슈로 고친다.
- 확인할 것: FE는 경로 기준을 `Run.referenceBasis`로 구분한다. 백엔드와 기준별 응답·표시 및 사이트 지도 생성·검증, 지원 화면 범위를 확인한다. 사이트 지도 변경은 계약 v1.3.7 제안이며, 위 항목은 실제 연동과 계약 확정 후 `docs/contracts/`와 mock에 반영하고 해당 행을 지운다. 모두 해소되면 이 항목을 지운다.
- 담당: 정자비(지표), 장근창(API).
