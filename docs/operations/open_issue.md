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

| ID | 항목 | 담당 | 임시 결정 |
| --- | --- | --- | --- |
| [OI-3](#oi-3) | 도착 화면 스크린샷 조회 | 정자비, 장근창 | 이미지 없이 표시 |
| [OI-8](#oi-8) | 분석 대상 사이트 입력 | 장근창 | 입력란은 두되 요청에 싣지 않고, MORO MARKET 외 값은 안내 후 시작을 막음 |
| [OI-7](#oi-7) | 저장된 실측 데이터 시연 | 정자비 | `/replay`에서 원본 `LIVE` Run을 조회해 재생, 서버 없는 시연은 P0 제외 |
| [OI-9](#oi-9) | 목표·사용자 유형 직접 입력 | 정자비, 장근창 | 백엔드 구현(UX-Mirror-BE #39·#42·#44) 기준으로 요청·표시, 계약 v1.3.6 반영 전까지 임시 |
| [OI-10](#oi-10) | 경로 지표 기준(basis)·우회 이동 | 정자비, 장근창 | 설계 v2.1 기준으로 optional로 받고, 없으면 `ALLOWED_PATHS`·`detourMoveCount: null` |

## 항목

<a id="oi-3"></a>
### OI-3 도착 화면 스크린샷 조회

- 계약서: 목표 화면에 도착만 하고 모델 판단을 하지 않은 화면은 Step이 없고(`§15.3`), 스크린샷 API는 `stepId` 기준이다(`§17.7`).
- 경로의 마지막 노드(환불 신청 화면)의 이미지를 가져올 방법이 없다. 백엔드 실행 API는 이 항목을 범위에서 제외했다.
- 임시 결정: 해당 노드에 "도착 화면 이미지 없음"을 표시한다.
- 확인할 것: 도착 화면 이미지를 저장할지, 저장한다면 `PathVisit`에 참조를 둘지 별도 endpoint를 둘지. 저장 구조(정자비)가 정해진 뒤 결정하고, API는 별도 endpoint 또는 기존 스크린샷 API 확장으로 제공될 예정이다.
- 담당: 정자비(저장), 장근창(API).

<a id="oi-7"></a>
### OI-7 저장된 실측 데이터 시연

- 계약서: `SAVED_MEASURED`는 과거 실제 호출 결과를 저장한 뒤 재생한 결과다(`§2.1`).
- 백엔드 결정: P0에서는 `SAVED_MEASURED` Run을 만들지 않는다. 시연은 원본 `LIVE` Run을 기존 조회 API(`GET /api/runs`, `/api/runs/{runId}`, `/steps`, `/screenshots`, `/api/comparisons/{experimentKey}`)로 읽기만 해서 재생한다. 새 API는 없고 원본 데이터의 `resultOrigin`은 `LIVE` 그대로다. 복사본이 필요하면 별도 `runId`·`experimentKey`로 복사하고 복사본만 `SAVED_MEASURED`로 저장한다.
- 시연 Run 고정: 백엔드 `results/final_execution_plan.json`의 `experimentKey`로 고정한다(제안). 재생 중 `LIVE` 실행은 다른 `experimentKey`로만 하며, 같은 키에 `VALID` Run이 있으면 `409 EXPERIMENT_RUN_EXISTS`로 원본이 보호된다.
- 임시 결정: 재생 모드는 `/replay`에서 고정 `experimentKey`의 Run 목록을 읽어 기존 화면으로 연결한다. 고정 키는 `src/features/replay/constants.ts`의 `REPLAY_EXPERIMENT_KEY`이며 지금은 mock 시드 `mock-done`인 **임시 값**이다. 서버 없는 시연(정적 결과 파일 읽기)은 P0에서 하지 않는다. 기획안이 복잡한 리플레이를 P0 밖에 두고 이 요구를 찾지 못했기 때문이다.
- 확인할 것: 고정할 실제 `experimentKey` 값(정자비). 받으면 상수를 바꾼다. "서버가 꺼져도 시연 가능"(역할 분담 5번 완료 기준)을 P0에 넣을지는 기획 확인 후 최종 결정한다.
- 담당: 정자비.

<a id="oi-8"></a>
### OI-8 분석 대상 사이트 입력

- 계약서: `POST /api/runs` 요청 본문은 `experimentKey`, `variant`, `goalId`, `personaId`, `maxSteps`다. 사이트(주소)를 받는 필드는 없고 대상은 `variant`에 따라 백엔드가 정한다.
- 임시 결정: 새 UX 분석 화면의 "분석 사이트"를 입력할 수 있게 두되 값은 요청에 싣지 않는다. 입력값이 MORO MARKET(대소문자·앞뒤 공백 무시)이 아니거나 비어 있으면 안내를 보이고 분석 시작을 막는다. 입력한 대상과 실제 분석 대상이 달라지지 않게 하기 위해서다.
- 확인할 것: 임의 사이트를 분석할지, 요청 필드(예: 사이트 주소·버전별 주소)와 검증 규칙을 어떻게 둘지. 확정되면 계약서를 고치고 입력값을 요청에 싣는다.
- 담당: 장근창(API).

<a id="oi-9"></a>
### OI-9 목표·사용자 유형 직접 입력

- 계약서(v1.3.5): `POST /api/runs`는 `goalId`·`personaId`만 받고 문구는 preset에서 복사한다(`§5.1`, `§17.2`).
- 백엔드 구현: UX-Mirror-BE #42에서 `goal`+`verification`, `persona` 직접 입력을 받는다(ID와 둘 중 하나만, 빈 값·200자 초과·누출 금지 문자열·성공 조건 오류는 `422`, 같은 `experimentKey`의 두 번째 Run은 첫 Run과 입력이 같아야 함). Run에는 `verification`이 항상 저장되고(preset 실행도 복사), 직접 입력한 목표는 `referencePathConfig: null`이다. #39(루프)는 경로 기반 지표를 `null`로, #44(비교)는 `GOAL_MATCHED`를 목표 문장+`verification`, `PERSONA_MATCHED`를 문장 기준으로 판정하고 `verification`이 없는 과거 Run은 확인 불가로 처리한다.
- 임시 결정: 프론트는 위 백엔드 동작을 기준으로 요청을 보내고 표시한다. 성공 조건의 도착 화면은 서버가 아직 실제 화면인지 검사하지 않으므로 화면에서 목록으로만 고른다.
- 확인할 것: 계약 v1.3.6에 요청 필드·Run `verification`·비교 조건이 반영되면 `docs/contracts/`를 고치고 이 항목을 지운다.
- 담당: 정자비(루프·프론트), 장근창(API).

<a id="oi-10"></a>
### OI-10 경로 지표 기준(basis)·우회 이동

- 계약서(v1.3.5): `referencePathConfig`는 허용 경로(`allowedPaths`·`shortestAllowedSteps`)만 정의하고 `basis`·`detourMoveCount`는 없다.
- 임시 결정: 설계 v2.1(3.1·3.2·4.1)에 따라 `referencePathConfig.basis`(`ALLOWED_PATHS` / `SITE_MAP`)와 `summary.detourMoveCount`를 optional로 받는다. `basis`가 없으면 `ALLOWED_PATHS`, 필드가 없는 과거 Run도 `ALLOWED_PATHS`, 명시적 `null`만 기준 없음이다. `detourMoveCount`가 없으면 `null`이다. SITE_MAP 설정은 설계 v2.1 4.1의 `siteMapVersion`·`siteMapHash`·`startPageKey`·`goalPageKey`·`shortestSteps`·`distances`(화면별 거리, 도달 불가는 `null`)로 읽으며 화면에는 쓰지 않는다. 우회 이동은 BACK을 뺀 모델 CLICK 이동 중 거리가 줄지 않은 횟수이고(설계 3.1), mock도 이 정의를 따른다.
- 확인할 것: 백엔드가 `basis`·`detourMoveCount`·SITE_MAP 설정 형식을 확정하고 계약서에 반영되면 `docs/contracts/`를 고치고 이 항목을 지운다.
- 담당: 정자비(지표), 장근창(API).
