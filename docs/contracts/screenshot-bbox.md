# 스크린샷과 bbox

Playwright가 캡처한 실제 쇼핑몰 화면 위에 후보 박스와 확률을 표시한다. 프론트는 원본 화면을 받아 박스를 직접 그린다.

## 원본과 오버레이

| 종류 | 내용 | 용도 |
| --- | --- | --- |
| 원본 스크린샷 | Playwright가 캡처한 화면 그대로. 박스·배지 없음 | 프론트가 사용 |
| 오버레이 스크린샷 | 백엔드 도구가 그린 후보 번호 박스(`candidates`)나 확률 배지(`b5`)가 포함된 이미지 | 백엔드 확인용. 프론트 계약에 포함하지 않음 |

- `BE 확인`: 백엔드의 `results/screenshots/b5`는 확률 배지가, `candidates`는 후보 번호 박스가 그려진 이미지다. 두 종류 모두 오버레이이며 Git에 올라가지 않는다.
- 프론트는 원본 이미지를 우선 사용한다. 오버레이 이미지를 쓰면 박스가 이미 그려져 있어 확률 표시·선택 강조·단계 간 전환을 프론트에서 제어할 수 없다.
- 이미지 제공 방식(경로·URL·크기)은 아직 정해지지 않았다. [OI-6](../operations/open_issue.md#oi-6)

## 필요한 데이터

| 데이터 | 위치 | 출처 |
| --- | --- | --- |
| 이미지 | `GET /api/runs/{runId}/screenshots/{stepId}` 또는 `Step.screenshot.imageUrl` | `임시` |
| 이미지 크기 `width`·`height` | `Step.screenshot` (이미지 픽셀) | `임시` |
| viewport | `Run.viewport` (기본 1440×900) | `BE 확인` |
| scroll 위치 `scrollX`·`scrollY` | `Step.screenshot` | `임시` |
| 후보 `bbox`·`probability`·`selected` | `Step.candidates[]` | `BE 확인`(bbox), `임시`(나머지) |

## 좌표 기준

- `bbox`는 `{ x, y, width, height }`이며 단위는 브라우저 viewport 기준 CSS 픽셀이다. `(0, 0)`은 viewport 왼쪽 위다. `BE 확인`
- 현재 후보는 첫 화면(스크롤 없음)에 보이는 요소만 대상이므로 `scrollX`·`scrollY`는 0이다. 스크롤한 화면이 생기면 `x - scrollX`, `y - scrollY`로 보정한다(`임시`). [OI-7](../operations/open_issue.md#oi-7)
- 이미지가 viewport와 같은 비율이면 이미지 픽셀과 CSS 픽셀이 같다. 이미지를 더 크게 저장하면(`devicePixelRatio` ≠ 1) 이미지 `width`가 `viewport.width`보다 크다. 박스 변환은 항상 viewport 대비 비율로 하므로 이 차이가 결과에 영향을 주지 않는다.

## 축소 표시 변환

화면에 표시하는 이미지 폭을 `displayWidth`라 할 때:

```
scale   = displayWidth / viewport.width
left    = (bbox.x - scrollX) * scale
top     = (bbox.y - scrollY) * scale
width   = bbox.width  * scale
height  = bbox.height * scale
```

- 이미지 컨테이너를 `position: relative`로 두고 박스를 `position: absolute`로 얹는다.
- 이미지 크기가 바뀌어도(창 크기 변경) 위치가 어긋나지 않도록 픽셀 대신 비율(%)을 쓴다: `left% = (x - scrollX) / viewport.width * 100`, `top% = (y - scrollY) / viewport.height * 100`, `width% = width / viewport.width * 100`, `height% = height / viewport.height * 100`.
- 이미지의 가로세로 비율은 `viewport`와 같다고 가정하고(`1440:900`) 컨테이너에 `aspect-ratio`를 지정한다. 이미지 `width`·`height`가 이 비율과 다르면 `viewport` 대신 이미지 크기를 기준으로 계산한다(`임시`).

예: `bbox = { x: 570, y: 26, width: 84, height: 28 }`, viewport 1440×900, 표시 폭 720px이면 `scale = 0.5`이므로 `left = 285`, `top = 13`, `width = 42`, `height = 14`다. 실측(`candidates_20261115_222518/before_home.json`)의 `option_01` 값이다.

## 확률 표시

- 확률 배지는 `Candidate.probability`를 백분율로 표시하고 `selected`인 후보를 강조한다.
- 확률은 "모델이 각 행동에 부여한 정규화 값"이며 실제 사용자의 클릭 확률이 아니다. 화면에 이 문구를 함께 둔다.
- `probability`가 `null`(모델 판단 전)이면 박스만 그리고 확률은 표시하지 않는다.
- bbox가 `null`인 후보(GO_BACK)는 박스를 그리지 않고 목록에서만 보인다.
