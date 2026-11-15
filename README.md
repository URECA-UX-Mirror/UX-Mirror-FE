# UX-Mirror-FE

UX MIRROR 대시보드 (React + TypeScript + Vite). 백엔드·에이전트는 `UX-Mirror-BE` 저장소.

## 실행

```
npm install
copy .env.example .env
npm run dev        # http://localhost:5173
npm run build      # 배포용 빌드 (dist/)
```

## 설정

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | 백엔드 FastAPI 주소 |

`.env`는 Git에 올리지 않는다 (공개 저장소).

## 만들 화면 (`역할 분담.md` 5번)

| 화면 | 데이터 (백엔드 API) |
| --- | --- |
| ① 설정·실행 | `GET /api/presets`, `POST /api/runs` |
| ② 진행 상황 | `GET /api/runs/{runId}` |
| ③ 단계 재생 (스크린샷 + 확률 배지) | `GET /api/runs/{runId}/steps`, `/screenshots/{stepId}` |
| ④ Before/After 비교 | `GET /api/comparisons/{experimentKey}` |
| ⑤ UX 문제 목록 | `GET /api/runs/{runId}/issues` |

확률 배지는 Step의 `bbox`(스크린샷 왼쪽 위 기준 CSS 픽셀, 뷰포트 1440×900)로 그린다.

## 브랜치

`main`(제출용) ← `develop`(통합) ← `유형/이슈번호-간단한 내용`(각자 작업). PR은 1명 승인 후 머지. 브랜치·커밋·Issue·PR 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
