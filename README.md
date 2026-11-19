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
| 진단하기 (`/`) | `GET /api/health`, `POST /api/runs` |
| 다른 사이트 진단 (`/scenario`) | `GET /api/health`, `GET /api/sites`, `POST /api/runs` |
| 진단 중 (`/runs/:runId`) | `GET /api/health`, `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, 시나리오 Run의 `GET /api/sites` |
| 진단 결과 (`/runs/:runId/result`) | `GET /api/health`, `GET /api/runs`, `POST /api/runs`(개선안으로 해 보기), `POST /api/improvements`(AI에게 고쳐 달라고 하기), `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/screenshots/goal`, `/issues`, 시나리오 Run의 `GET /api/sites` |
| 지금 화면 vs 개선안 (`/comparisons/:experimentKey`) | `GET /api/health`, `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}`, `/api/runs/{runId}/steps`, `/api/runs/{runId}/screenshots/{stepId}` |
| 메뉴 이름 후보 비교 (`/optimizations`) | `GET /api/health`, `POST /api/optimizations` |
| 후보 비교 결과 (`/optimizations/:optimizationId`) | `GET /api/optimizations/{optimizationId}`, `POST /api/optimizations/{optimizationId}/verify`, `GET /api/optimizations/{optimizationId}/report` |
| AI 개선 결과 (`/improvements`, `/improvements/:improvementId`) | `GET /api/health`, `GET /api/improvements`, `POST /api/improvements`, `GET /api/improvements/{improvementId}`(진행 중이면 3초마다, [OI-13](docs/operations/open_issue.md#oi-13)) |

화면 이름은 `src/shared/pageNames.ts` 한 곳에서 정한다. 화면에는 서버 코드값(상태·멈춘 이유·문제 유형·`CLICK`/`GO_BACK`·Run ID)을 그대로 보이지 않고 `src/shared/runLabels.ts`의 사용자 말로 바꿔 보인다.

AI 개선은 진단 결과의 "AI에게 고쳐 달라고 하기"나 `/improvements`의 입력(고객 유형·할 일·도착 화면)으로 시작한다. 서버에서는 한 번에 하나만 돌고(약 5분), 그동안 다른 진단은 시작할 수 없다. 결과 화면은 진행 단계 → 바꿔 볼 이름과 점수 → 개선안에서 다시 확인한 결과 → 회차 기록(접힘) → 점수 계산(접힘) 순이다. 공식 결과(`kind: OFFICIAL`)와 심사 실행(`LIVE`)은 태그로 구분한다.

`/replay`는 고정 `experimentKey`(E 실행 목표별 네 개)마다 저장된 Run을 조회만 해서 위 화면들로 연결하는 재생 모드다(`GET /api/runs?experimentKey=`만 호출하고 Run을 만들지 않는다). 고정 키는 E 실행 최종 실행 계획의 키 네 개다([미결정 항목](docs/operations/open_issue.md) OI-7).

Optimizer 검증 Run(`GET /api/runs`·`/api/runs/{runId}` 응답에 `optimizationContext`가 있는 Run)은 진행·결과·비교 화면과 "다른 실행 보기"에서 `variant`와 함께 후보 라벨·역할을 표시한다. mock 시드는 `opt_mock_evaluated`(검증 전), `opt_mock_completed`(보고서), `opt_mock_site_changed`(검증 실패)다.

mock 모드에서 ③ 결과 화면(`/runs/:runId/result`)은 시드 Run으로 확인한다: `run_mock_done_before`(정상), `run_mock_goback`(모델 GO_BACK), `run_mock_maxsteps`(목표 미도달), `run_mock_invalid`·`run_mock_invalid_only`(무효 처리), `run_mock_issue_pending`·`run_mock_issue_failed`·`run_mock_issue_empty`(Issue 분석 상태), `run_mock_direct_before`(목표·사용자 유형 직접 입력, 허용 경로 없음. 실험 키 `mock-direct`), `run_mock_sitemap`(사이트 지도 기준·우회 이동 있음), `run_mock_mapfail`(지도 오류로 경로 기준 없음), `run_mock_direct_mapfail`(직접 입력한 목표의 지도 오류), `run_mock_legacy_basis`(`basis` 없는 과거 Run).

④ 비교 화면은 mock 모드에서 `/comparisons/mock-sitemap`(양쪽 사이트 지도 기준, 우회 이동 행 표시), `/comparisons/mock-basis-mismatch`(기준 불일치로 `REFERENCE_PATH_CONFIG_MATCHED` 실패), `/comparisons/mock-done`(허용 경로)으로 확인한다. 비교 응답에는 기준이 없어 각 Run(`GET /api/runs/{runId}`)의 기준을 읽어 Run 단위 비교에 표시한다.

진단하기는 MORO MARKET에서 "어떤 고객이, 무엇을 하려고, 어느 화면까지 오는지" 세 칸만 받는다. 확인 글자·찾는 범위·최대 클릭 수는 도착 화면마다 정해진 값으로 채우고, 실험 키는 매번 새로 만든다. 문장 검사는 BE와 같은 규칙(`src/shared/inputRules.ts`)으로 시작 전에 안내한다. 엔진이 `READY`가 아니거나 다른 진단·AI 개선·후보 비교가 진행 중이면 시작을 막고 진행 중인 화면 링크를 보인다.

다른 사이트 진단은 사이트 링크를 붙여 넣으면 도메인이 `GET /api/sites`의 `allowedHosts`에 있는 등록 사이트를 찾아 그 `siteId`로 Run 1개를 시작한다. 등록되지 않은 도메인이면 시작할 수 없다(임시, [OI-11](docs/operations/open_issue.md#oi-11)).

화면 테마는 기기 설정을 따르고 상단 바의 "어둡게/밝게" 버튼으로 바꿀 수 있다(선택은 브라우저에 저장).

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
