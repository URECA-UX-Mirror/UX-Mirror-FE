# 스크린샷과 bbox

Playwright가 캡처한 실제 쇼핑몰 화면 위에 후보 박스와 확률을 표시한다. 프론트는 원본 화면을 받아 박스를 직접 그린다. `계약 §7.1`

## 원본과 오버레이

| 종류 | 내용 | 조회 | 용도 |
| --- | --- | --- | --- |
| 원본 | Playwright가 캡처한 viewport 화면. 박스·배지 없음 | `?kind=original`(기본) | 프론트가 사용 |
| 오버레이 | 확률 배지를 그려 저장한 이미지. 없을 수 있다 | `?kind=overlay` | 데모 백업용. 프론트는 요청하지 않는다 |

프론트가 원본을 쓰는 이유: 오버레이는 확률 표시와 선택 강조를 프론트가 제어할 수 없고, 단계 전환·버전 비교 화면에서 박스를 따로 그릴 수 없다. `계약 §7.1`("Frontend 기본 오버레이는 원본 PNG + bbox로 직접 그린다")

## 필요한 데이터

| 데이터 | 위치 |
| --- | --- |
| 이미지 | `GET /api/runs/{runId}/screenshots/{stepId}` (`계약 §17.7`) |
| 이미지 크기 | `Step.page.screenshotSize` |
| viewport | `Step.page.viewport` (`Run.viewport`와 같다) |
| scroll | `Step.page.scroll` (`x`, `y`) |
| 후보 박스 | `Step.candidateSet.candidates[].bbox` |
| 후보별 확률 | `StepCandidate.probability` |
| 모델이 고른 후보 | `StepCandidate.selected` |
| GO_BACK 확률 | `Step.decision.goBackProbability` |

`overlayScreenshotRef`와 `screenshotRef`는 서버 내부 참조이므로 프론트가 주소로 쓰지 않는다. 이미지 주소는 항상 `VITE_API_BASE_URL`에 API 경로를 붙여 만든다.

## 좌표 기준

- `bbox`는 `{ x, y, width, height }`이며 스크린샷 왼쪽 위 기준 CSS 픽셀이다. `width`, `height`는 0보다 크다. `계약 §7.2`
- 클릭 후보는 `bbox`가 항상 있다. GO_BACK은 후보가 아니라 `backOptionId`로 표현되며 박스가 없다. `계약 §8.1`
- 화면이 바뀐 뒤 이전 Step의 bbox를 재사용하지 않는다. 박스는 항상 같은 Step의 `screenshot`과 짝으로 그린다.
- 후보는 첫 화면(스크롤 없음)에서 보이는 요소이므로 `scroll`은 보통 `{0, 0}`이다. 값이 있으면 `x - scroll.x`, `y - scroll.y`로 보정한다(`임시`).

## 축소 표시 변환

화면에 표시하는 이미지 폭을 `displayWidth`라 할 때:

```
scale   = displayWidth / viewport.width
left    = (bbox.x - scroll.x) * scale
top     = (bbox.y - scroll.y) * scale
width   = bbox.width  * scale
height  = bbox.height * scale
```

- 이미지 컨테이너를 `position: relative`로 두고 박스를 `position: absolute`로 얹는다.
- 창 크기가 바뀌어도 위치가 어긋나지 않도록 비율(%)로 지정한다: `left% = (x - scroll.x) / viewport.width * 100`, `top% = (y - scroll.y) / viewport.height * 100`, `width% = width / viewport.width * 100`, `height% = height / viewport.height * 100`.
- 컨테이너에 `aspect-ratio: viewport.width / viewport.height`를 지정한다. `screenshotSize`가 viewport와 다른 비율이면 `viewport` 대신 `screenshotSize`를 기준으로 계산한다.
- **컨테이너는 `overflow: hidden`이다.** 후보가 화면 아래 끝에 걸쳐 있으면 박스가 viewport 밖으로 나간다. 예: `y=799`, `height=196`이면 아래 끝이 995로 viewport 높이 900을 넘는다(백엔드 후보 수집 결과 `before_home.json`의 `option_04`). 이 경우 보이는 부분만 그린다.

예: `bbox = { x: 570, y: 26, width: 84, height: 28 }`, viewport 1440×900, 표시 폭 720px이면 `scale = 0.5`이므로 `left = 285`, `top = 13`, `width = 42`, `height = 14`다.

## 확률 표시

- 후보 확률은 백분율로 표시하고 `selected`인 후보를 강조한다. 소수 첫째 자리까지 반올림하되 원본 값은 보존한다.
- 확률 합계는 최대 0.02까지 오차를 허용한다(`계약 §12.3`). 반올림한 백분율의 합이 100이 아닐 수 있으므로 "합계 100%"라고 단정하지 않는다.
- 이 확률은 "모델이 각 행동에 부여한 정규화 값"이며 실제 사용자의 클릭 확률이 아니다. 화면에 이 문구를 함께 둔다.
- GO_BACK 확률은 `decision.goBackProbability`로 목록에만 표시한다. 값이 `null`이면 GO_BACK이 선택지에 없었던 것이다.
- `decision.selectedActionType`이 `GO_BACK`이면 모든 후보의 `selected`가 `false`다. 이때 박스 강조 없이 "이전 화면 복귀 선택"을 표시한다.

## 이미지가 없는 경우

- `404`이면 자리표시를 보인다(진행 중 "화면 준비 중", 종료 "화면 없음"). `rest-api.md`의 스크린샷 절을 따른다.
## 도착 화면 이미지

모델 판단 없이 도착만 한 화면은 Step이 없고(`계약 §15.3`) 스크린샷 API가 `stepId` 기준이라, 별도 endpoint `GET /api/runs/{runId}/screenshots/goal`로 가져온다(임시, [OI-3](../operations/open_issue.md#oi-3)).

- 경로의 마지막 노드이고 `Run.terminationReason`이 `GOAL_VERIFIED`일 때만 이미지를 요청한다. 다른 종료 사유의 Run은 호출하지 않고 "마지막 화면 이미지 없음"을 표시한다.
- 요청한 이미지가 `404`이거나 불러오지 못하면 "도착 화면 이미지 없음"을 표시한다.
- Step의 후보 좌표가 없으므로 bbox 오버레이는 그리지 않는다.
