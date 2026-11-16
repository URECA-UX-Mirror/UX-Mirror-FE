# 지표와 목표 판정

프론트는 백엔드가 계산한 값을 표시한다. 이 문서는 표시할 값의 의미와 프론트의 책임 범위를 정한다. 정의의 정본은 계약서 §12.3(지표), §2.3·§10.2(목표 판정)다.

## 목표 도달 판정

- 판정 방식은 `DOM_ONLY`다. 모델에 목표 YES/NO를 묻지 않고(`modelGoalReached = null`) 브라우저에서 확인한 경로와 화면에 보이는 글자만 쓴다. 모델 판정(`MODEL_AND_DOM`)은 `P1`이다. `계약 §4.4`
- 성공 조건은 목표마다 정하며 현재 `refund`(환불 신청 화면 찾기)는 경로가 `/shop/refund`이고 `환불 / 반품 신청` 글자가 화면에 보일 때 성공이다. 주소만 맞거나 글자만 보이는 것은 도착이 아니다. `계약 §2.3`
- 성공 조건(`verification`)은 백엔드 전용이며 프론트에는 전달되지 않는다. `계약 §19`
- 프론트는 `Run.summary.goalReached`를 표시할 뿐 도달 여부를 판정하지 않는다. `goalReached`는 항상 화면 판정(`verifiedGoalReached`)과 같다. `계약 §10.2`
- 화면 문구는 "목표 화면 도달"을 쓴다. "DOM 마커 검증" 같은 표현은 쓰지 않는다. 마커 방식은 폐기됐다.

## 선택 확률과 실제 행동

- **선택 확률**은 모델이 후보마다 부여한 정규화 값이다. 실제 사용자의 클릭 확률이 아니다.
- **실제 행동**은 Playwright가 수행한 결과(`Step.action`)다. 모델의 선택(`decision.selectedOptionId`)과 실행한 후보(`action.executedOptionId`)를 구분해 표시한다. `selectedOptionId`가 최대 확률 후보와 같다고 가정하지 않는다. `계약 §10.1`
- 같은 목적지로 가는 후보는 모델에 그대로 보내고, 분석에서만 합친다. 합친 값은 프론트에 `goalPathProbability`로만 온다.

## 지표 (Step 단위, `StepDecision`)

모든 지표는 단위 없는 비율(0~1)이며 계산할 수 없으면 `null`이다. `계약 §12.3`

| 필드 | 의미 | `null` 조건 |
| --- | --- | --- |
| `normalizedEntropy` | 전체 선택지(클릭 후보 + GO_BACK) 확률 분포의 엔트로피 ÷ ln(선택지 수). 클수록 선택이 분산돼 있다 | 선택지가 2개 미만 |
| `clickOnlyNormalizedEntropy` | GO_BACK을 뺀 클릭 후보 확률을 합계로 나눠 다시 정규화한 엔트로피 | 클릭 후보 2개 미만, 또는 클릭 후보 확률 합이 `1e-12` 이하 |
| `top2Margin` | 전체 선택지의 1위 확률 − 2위 확률 | 선택지가 2개 미만 |
| `clickOnlyTop2Margin` | 클릭 후보만 재정규화한 분포의 1위 − 2위 | `clickOnlyNormalizedEntropy`와 같음 |
| `goBackProbability` | GO_BACK 선택지의 확률 | GO_BACK이 선택지에 없음 |
| `goalPathProbability` | 허용 경로에서 다음 화면으로 이어지는 클릭 후보들의 확률 합(같은 목적지는 합산) | 그런 후보가 없음 |
| `modelLatencyMs` | 모델 판단 소요 시간, 정수 밀리초 | 값이 없음 |
| `metricWarnings` | 지표 계산 경고. 없으면 `[]` | — |

- `metricWarnings`에 `NO_CLICK_PROBABILITY_MASS`가 있으면 클릭 조건부 지표가 `null`이며 해당 Step의 `CHOICE_AMBIGUITY` Issue는 만들어지지 않는다. 프론트는 `message`를 표시하고 지표 칸에 "계산 불가"를 표시한다.
- `confidence`는 `Step`에 전달되지 않는다. 모델 응답의 `confidence`는 확률과 같은 값이 아니다(`계약 §10.1`).
- 표시 형식: 비율은 소수 둘째 자리, `top2Margin` 계열은 `%p`(`0.12` → `12.0%p`), 확률은 `%`다. 엔트로피에는 단위(`bit`)를 붙이지 않는다. 반올림은 표시 단계에서만 한다.
- 화면 지표 비교(`ScreenMetricComparison`)의 `delta`는 서버가 계산한 `after - before`다. 프론트가 다시 계산하지 않는다.

## 프론트의 책임 범위

- 지표를 계산하거나 보정하지 않는다. 비교 값과 Issue 판정은 백엔드 결과를 쓴다.
- 허용되는 가공은 단위 변환(×100), 반올림, 서버 순서 유지, `null` 표시(`-` 또는 "계산 불가")뿐이다.
- **서버가 주지 않는 판정 문구를 만들지 않는다.** "개선", "단축", "소멸", "해소됨", "~배", "~% 절감" 같은 해석을 표시하지 않는다. before와 after 값을 나란히 보이고, 서버가 준 `delta`가 있으면 증감만 표시한다. `계약 §15.5`
- Issue는 "AI 탐색 기록 기반의 검토 후보"이며 실제 사용자 결함이 아니다. `reviewPriority`는 표시 순서이며 심각도가 아니다(`계약 §4.13`). 우선순위는 "우선 검토"와 "일반 검토" 두 단계로만 표시하고 "높음/낮음" 같은 심각도 표현을 쓰지 않는다.
- 비교 결과는 모델의 관찰값이다. 실제 사용자 행동 변화를 단정하는 문구를 쓰지 않는다.
- Issue 비교는 두 Run의 `detectedIssueTypes`를 나란히 "탐지됨 / 탐지되지 않음"으로 표시하고 "해소됨" 판정을 만들지 않는다.
- Run 단위 값(`navigationCost`, `stepCount`, `backCount` 등)은 before/after를 나란히만 표시한다. P0에서 Run 단위 `delta`는 서버 계약에 없고, 프론트도 정수 뺄셈이나 상승·하락 화살표를 만들지 않는다. step이 줄었다고 항상 개선은 아니고 목표 미달성 Run과의 단순 차이는 오해를 만들기 때문이다. P0의 정량 비교는 화면 단위 확률·엔트로피·Top-2 margin의 `delta`로 한정한다. Run 단위 `delta`는 `P1`에서 `After - Before`, 비교 불가 시 `null`로 서버 계약에 추가할 수 있다.
- 값이 `null`이면 0으로 바꾸지 않는다.
- 모델 확률이 1에 가까워도 목표 도달 여부는 `goalReached`로만 표시한다.
