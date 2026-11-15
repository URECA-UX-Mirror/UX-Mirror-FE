# 지표와 목표 판정

프론트는 백엔드가 계산한 값을 표시한다. 이 문서는 표시할 값의 의미와 프론트의 책임 범위를 정한다. 지표 정의는 `UX-Mirror-BE`의 `uxm/metrics.py`와 `uxm/goal.py`를 확인한 내용이다.

## 목표 도달 판정

`BE 확인`(`uxm/goal.py`):

- 판정 방식은 `DOM_ONLY`다. 모델에 YES/NO를 묻지 않고(`modelGoalReached = null`) Playwright가 보는 화면만으로 판정한다. 모델 YES/NO 판정(`MODEL_AND_DOM`)은 `P1`이다.
- 성공 조건은 목표마다 정한다. 현재 목표 `refund`(환불 신청 화면 찾기)는 **주소 경로가 `/shop/refund`이고, 화면에 `환불 / 반품 신청` 글자가 실제로 보일 때** 성공이다. 주소만 맞아서는 성공이 아니다.
- 성공 조건은 채점용이며 모델 입력에는 목표 문구만 들어간다.
- `goalReached`는 언제나 화면 판정 결과와 같다. 백엔드 판정 기록에는 `pathMatched`, `textVisible`, `successCondition`이 있다.
- 과거 방식(쇼핑몰의 `data-test-goal` 마커)은 제거됐다. 디자인 시안의 "DOM 마커 검증" 문구는 현재 구현과 다르므로 화면 문구는 "목표 화면 도달"로 쓴다. [OI-18](../operations/open_issue.md#oi-18)

프론트는 `Run.summary.goalReached`를 표시할 뿐 도달 여부를 직접 판정하지 않는다. 판정 근거(`pathMatched`, `textVisible`)를 화면에 보여 줄지는 [OI-18](../operations/open_issue.md#oi-18)에서 정한다.

## 선택 확률과 실제 행동

- **선택 확률**은 모델이 후보마다 부여한 정규화 값이다(합계 1). 실제 사용자가 클릭할 확률이 아니다.
- **실제 행동**은 Playwright가 수행한 결과(`Step.action`)다. 확률이 가장 높은 후보를 고르는 것이 기본이지만 모델의 선택(`decision.choice`)과 실제 행동은 구분해서 표시한다.
- 같은 목적지로 가는 후보는 모델에는 그대로 보내고, 분석에서만 합친다(`probabilityByDestination`).

## 지표

`BE 확인`(`uxm/metrics.py`). 모든 값은 Step 단위이며 단위 없는 소수(비율)다.

| 필드 | 의미 | 범위·null |
| --- | --- | --- |
| `normalizedEntropy` | 전체 행동(GO_BACK 포함) 확률의 정규화 엔트로피 `H / ln(N)`. 클수록 선택이 분산돼 있다 | 0~1, 계산할 수 없으면 `null` |
| `clickOnlyNormalizedEntropy` | GO_BACK을 제외하고 CLICK 후보만 다시 정규화한 엔트로피 | 0~1, 계산할 수 없으면 `null` |
| `top2Margin` | 1순위 확률 − 2순위 확률(전체 행동 기준) | 0~1, `null` 가능 |
| `clickOnlyTop2Margin` | CLICK 후보만 재정규화한 Top-2 격차 | 0~1, `null` 가능 |
| `goBackProbability` | GO_BACK 후보의 확률 | 0~1, GO_BACK 후보가 없으면 `null` |
| `probabilityByDestination` | 같은 목적지(경로)로 가는 후보 확률의 합. 값이 큰 순서로 정렬 | 경로 → 0~1 |

- 표시 규칙: 비율은 소수 둘째 자리(예 `0.74`), `top2Margin`은 `%p`(`0.12` → `12.0%p`), 확률은 `%`로 표시한다. 값을 반올림하는 것은 표시 단계에서만 한다.
- 디자인 시안의 `Conditional Entropy (bit)`와 `Model Latency (ms)`는 백엔드 지표에 같은 정의가 없다. 시안의 단위 `bit`는 쓰지 않고 `clickOnlyNormalizedEntropy`(단위 없음)로 대체한다. `Model Latency`는 `decision.timingMs`(`BE 확인`: 응답의 `timing_ms`)로 표시한다. [OI-11](../operations/open_issue.md#oi-11)
- 비교 화면의 `pathCost`(탐색 이동 비용)와 `goalPathProbability`(시작 화면에서 목표 경로로 이어지는 후보 확률 합)는 백엔드 정의가 없는 `임시` 지표다. 정의가 정해지기 전에는 값만 표시하고 계산식은 쓰지 않는다.

## 프론트의 책임 범위

- 프론트는 지표를 계산하거나 보정하지 않는다. 비교 값(`delta`, `verdict`)과 Issue 판정은 백엔드 결과를 사용한다.
- 허용되는 가공은 단위 변환(×100), 반올림, 정렬, `null` 표시(`-`)뿐이다.
- Issue와 비교 결과는 "AI 탐색 기록 기반의 검토 후보"이며 UX 결함의 확정이나 사용자 행동의 단정이 아니다. 화면에 이 점을 안내하는 문구를 둔다.
- 값이 `null`이면 0으로 바꾸지 않고 "측정 불가" 또는 `-`로 표시한다.
- 모델 확률이 1에 가까워도 목표 도달 여부는 `goalReached`로만 표시한다.
