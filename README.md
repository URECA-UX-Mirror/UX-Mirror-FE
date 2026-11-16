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
| `VITE_USE_MOCK` | `true` | `true`이면 MSW가 API 응답을 대신한다(백엔드 없이 개발). 실제 서버를 쓰려면 `false` |

`.env.example`을 그대로 복사하면 mock 데이터가 나온다. **실제 서버로 시연·확인할 때는 `.env`의 `VITE_USE_MOCK`을 `false`로 바꾸고 개발 서버를 다시 시작한다.** `.env`는 Git에 올리지 않는다 (공개 저장소). mock 모드의 시나리오는 `src/mocks/handlers/`의 주석, 환경변수 상세는 [로컬 환경](docs/operations/local-environment.md)을 따른다.

## 화면

| 화면 | 데이터 (백엔드 API) |
| --- | --- |
| ① 새 UX 분석 | `GET /api/presets`, `GET /api/health`, `GET /api/runs`, `POST /api/runs` |
| ② AI 탐색 진행 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` |
| ③ UX 탐색 분석 결과 | `GET /api/health`, `GET /api/runs`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues` |
| ④ 버전 비교 | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` |

mock 모드에서 ③ 결과 화면(`/runs/:runId/result`)은 시드 Run으로 확인한다: `run_mock_done_before`(정상), `run_mock_goback`(모델 GO_BACK), `run_mock_maxsteps`(목표 미도달), `run_mock_invalid`·`run_mock_invalid_only`(무효 처리), `run_mock_issue_pending`·`run_mock_issue_failed`·`run_mock_issue_empty`(Issue 분석 상태).

화면별 상태 관리, 요청·응답 형식, bbox 변환은 [docs/README.md](docs/README.md)의 문서를 따른다.

## 브랜치

`main`(제출용) ← `develop`(통합) ← `유형/이슈번호-간단한 내용`(각자 작업). PR은 1명 승인 후 머지. 브랜치·커밋·Issue·PR 규칙은 [AGENTS.md](AGENTS.md)를 따른다.
