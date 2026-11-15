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

## 화면

| 화면 | 데이터 (백엔드 API) |
| --- | --- |
| ① 새 UX 분석 | `GET /api/presets`, `GET /api/health`, `POST /api/runs` |
| ② AI 탐색 진행 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` |
| ③ UX 탐색 분석 결과 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues` |
| ④ 버전 비교 | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` |

화면별 상태 관리, 요청·응답 형식, bbox 변환은 [docs/README.md](docs/README.md)의 문서를 따른다.

## 브랜치

`main`(제출용) ← `develop`(통합) ← `유형/이슈번호-간단한 내용`(각자 작업). PR은 1명 승인 후 머지. 브랜치·커밋·Issue·PR 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
