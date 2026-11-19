# UX-Mirror-FE

UX MIRROR 대시보드 (React + TypeScript + Vite). 백엔드·에이전트는 `UX-Mirror-BE` 저장소.

## 실행

```
npm install
cp .env.example .env     # Windows는 copy .env.example .env
npm run dev        # http://localhost:5173
npm run build      # 배포용 빌드 (dist/)
npm test           # 자동 테스트 1회 실행
```

## 설정

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | 백엔드 FastAPI 주소 |
| `VITE_USE_MOCK` | `true` | `true`이면 MSW가 API 응답을 대신한다(백엔드 없이 개발). 실제 서버를 쓰려면 `false` |

`.env.example`을 그대로 복사하면 mock 데이터가 나온다. **실제 서버로 시연·확인할 때는 `.env`의 `VITE_USE_MOCK`을 `false`로 바꾸고 개발 서버를 다시 시작한다.** `.env`는 Git에 올리지 않는다 (공개 저장소). mock 모드의 시나리오는 `src/mocks/handlers/`의 주석(UX Optimizer API는 `src/mocks/fixtures/optimization.ts`의 주석), mock 스크린샷의 원본인 목업 쇼핑몰은 `mock-pages/`(찍는 방법은 [프론트엔드 구조](docs/architecture/frontend-structure.md)의 "목업 쇼핑몰"), 환경변수 상세는 [로컬 환경](docs/operations/local-environment.md)을 따른다.

## 화면

| 화면 | 데이터 (백엔드 API) |
| --- | --- |
| ① 새 UX 분석 | `GET /api/health`, `GET /api/runs`, `POST /api/runs` |
| 시나리오 테스트 (`/scenario`) | `GET /api/health`, `GET /api/sites`, `POST /api/runs` |
| ② AI 탐색 진행 | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, 시나리오 Run의 `GET /api/sites` |
| ③ UX 탐색 분석 결과 | `GET /api/health`, `GET /api/runs`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/screenshots/goal`, `/issues`, 시나리오 Run의 `GET /api/sites` |
| ④ 버전 비교 | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` |
| UX Optimizer (`/optimizations`) | `GET /api/health`, `POST /api/optimizations` |
| UX Optimizer 후보 평가·검증·보고서 (`/optimizations/:optimizationId`) | `GET /api/optimizations/{optimizationId}`, `POST /api/optimizations/{optimizationId}/verify`, `GET /api/optimizations/{optimizationId}/report` |
| 자동 개선 리포트 (`/improvements/:improvementId`) | 정적 파일 `/improvements/{improvementId}.json`(API 호출 없음, [OI-13](docs/operations/open_issue.md#oi-13)). `improvementId`는 영숫자·`_`·`-`만 허용한다 |

자동 개선 리포트의 개선 회차는 기본으로 접혀 있으며, 펼치면 회차별 진단·기준·후보 평가와 채택 사유 및 종료 사유를 확인할 수 있다. 평가 실패나 미실행 점수는 0점으로 표시하지 않는다. 사이드바 링크는 최종 리포트 id(`src/features/improvement/constants.ts`의 `FINAL_IMPROVEMENT_ID`, 현재 `imp-1119`)가 있을 때만 보인다. 최종 JSON 반영 절차는 [자동 개선 JSON 반영 절차](docs/operations/improvement-release.md)를 따른다.

자동 개선 리포트의 실제 브라우저 검증 영역은 저장된 Run의 경로·단계·Issue와 유효성을 표시한다. 종료된 유효 Run의 결과·진행 및 양쪽 Run이 종료된 유효 Run인 비교 링크는 실행 서버가 연결되어 있어야 열린다.

`/replay`는 고정 `experimentKey`(E 실행 목표별 네 개)마다 저장된 Run을 조회만 해서 위 화면들로 연결하는 재생 모드다(`GET /api/runs?experimentKey=`만 호출하고 Run을 만들지 않는다). 고정 키는 E 실행 최종 실행 계획의 키 네 개다([미결정 항목](docs/operations/open_issue.md) OI-7).

Optimizer 검증 Run(`GET /api/runs`·`/api/runs/{runId}` 응답에 `optimizationContext`가 있는 Run)은 진행·결과·비교 화면과 "다른 실행 보기"에서 `variant`와 함께 후보 라벨·역할을 표시한다. mock 시드는 `opt_mock_evaluated`(검증 전), `opt_mock_completed`(보고서), `opt_mock_site_changed`(검증 실패)다.

mock 모드에서 ③ 결과 화면(`/runs/:runId/result`)은 시드 Run으로 확인한다: `run_mock_done_before`(정상), `run_mock_goback`(모델 GO_BACK), `run_mock_maxsteps`(목표 미도달), `run_mock_invalid`·`run_mock_invalid_only`(무효 처리), `run_mock_issue_pending`·`run_mock_issue_failed`·`run_mock_issue_empty`(Issue 분석 상태), `run_mock_direct_before`(목표·사용자 유형 직접 입력, 허용 경로 없음. 실험 키 `mock-direct`), `run_mock_sitemap`(사이트 지도 기준·우회 이동 있음), `run_mock_mapfail`(지도 오류로 경로 기준 없음), `run_mock_direct_mapfail`(직접 입력한 목표의 지도 오류), `run_mock_legacy_basis`(`basis` 없는 과거 Run).

④ 비교 화면은 mock 모드에서 `/comparisons/mock-sitemap`(양쪽 사이트 지도 기준, 우회 이동 행 표시), `/comparisons/mock-basis-mismatch`(기준 불일치로 `REFERENCE_PATH_CONFIG_MATCHED` 실패), `/comparisons/mock-done`(허용 경로)으로 확인한다. 비교 응답에는 기준이 없어 각 Run(`GET /api/runs/{runId}`)의 기준을 읽어 Run 단위 비교에 표시한다.

새 UX 분석은 고정 사이트 MORO MARKET의 v1 실행을 지원하고, 변경 후 버전은 자동 개선 최종안 행의 비교 링크로 연다. 탐색 목표·사용자 유형은 문장으로 직접 입력하고, 성공 조건(도착 화면·보여야 할 글자)을 함께 입력한다. 엔진 상태가 `READY`로 확인된 경우에만 시작할 수 있다. 기존 실험 키를 입력하고 조회하면 서버에서 실행 기록과 분석 조건을 불러온다. 실행 시작 후 진행 화면 주소의 `experimentKey`로 같은 실험을 다시 열 수 있다.

시나리오 테스트는 서버에 등록된 사이트를 고르고 상황 문장·사용자 유형·도착 화면을 입력해 Run 1개를 시작한 뒤 진행 화면으로 이동한다. 비교·버전 선택은 없다(임시, [OI-11](docs/operations/open_issue.md#oi-11)).

화면별 상태 관리, 요청·응답 형식, bbox 변환은 [docs/README.md](docs/README.md)의 문서를 따른다.

## 브랜치

`main`(제출용) ← `develop`(통합) ← `유형/이슈번호-간단한 내용`(각자 작업). PR은 1명 승인 후 머지. 브랜치·커밋·Issue·PR 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

## 배포 (Vercel)

- `vercel.json`이 모든 경로를 `/index.html`로 보낸다. `BrowserRouter`를 쓰므로 `/scenario`, `/runs/:runId` 같은 경로에서 새로고침해도 404가 나지 않는다.
- Production Branch는 `main`이다. `develop`에 push하면 Preview 배포가 만들어진다. 개발 중에는 `develop`의 Preview 주소(`<프로젝트>-git-develop-<팀>.vercel.app`)를 쓰고, 제출·심사 전에 `develop`을 `main`에 병합해 Production 주소를 쓴다.
- Vercel의 Environment Variables에 `VITE_USE_MOCK=false`와 `VITE_API_BASE_URL`을 Production과 Preview 모두 넣는다. `VITE_` 변수는 빌드 때 번들에 들어가므로 값을 바꾸면 다시 배포해야 한다. `VITE_USE_MOCK`은 값이 정확히 `true`일 때만 켜지므로 넣지 않아도 꺼진다. 값이 없으면 `VITE_API_BASE_URL`은 기본값 `http://127.0.0.1:8000`으로 빌드된다.
- 프론트는 HTTPS이므로 백엔드도 HTTPS여야 한다. 단, 백엔드를 `http://127.0.0.1`로 두면 백엔드를 띄운 PC의 브라우저에서만 동작한다. Chrome으로 열고 로컬 네트워크 접근 권한 팝업에서 허용해야 하며, 거부하면 API 요청이 모두 실패한다. Safari는 HTTPS 페이지의 `http://127.0.0.1` 요청을 혼합 콘텐츠로 막을 수 있다(브라우저 버전마다 다르므로 배포 뒤 직접 확인한다). 다른 PC에서 쓰려면 백엔드를 HTTPS 주소로 공개한다.
- 백엔드 `.env`의 `UXM_CORS_ORIGINS`에 Vercel 주소를 추가한다. 주소가 정확히 일치해야 통과하므로 Production 주소와 `develop` 브랜치 별칭 주소(`-git-develop-`)만 넣는다. 커밋별 Preview 주소와 다른 브랜치의 Preview 주소는 허용되지 않는다. 환경변수 규칙은 [로컬 환경](docs/operations/local-environment.md)을 따른다.
- 백엔드 없이 화면만 보여 줄 때는 `VITE_USE_MOCK=true`로 배포하면 mock 데이터가 나온다. Vercel은 환경변수를 Production과 Preview에 따로 둘 수 있으므로 한쪽만 `true`로 둘 수 있다.
