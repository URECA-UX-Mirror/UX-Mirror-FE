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

`.env.example`을 그대로 복사하면 mock 데이터가 나온다. **실제 서버로 시연·확인할 때는 `.env`의 `VITE_USE_MOCK`을 `false`로 바꾸고 개발 서버를 다시 시작한다.** `.env`는 Git에 올리지 않는다 (공개 저장소). mock 모드의 시나리오는 `src/mocks/handlers/`의 주석(메뉴 이름 후보 비교 API는 `src/mocks/fixtures/optimization.ts`의 주석), mock 스크린샷의 원본인 목업 쇼핑몰은 `mock-pages/`(찍는 방법은 [프론트엔드 구조](docs/architecture/frontend-structure.md)의 "목업 쇼핑몰"), 환경변수 상세는 [로컬 환경](docs/operations/local-environment.md)을 따른다.

## 화면

핵심 흐름은 **진단하기 → 진단 → AI 개선 → 지금 화면 vs 개선안** 하나다. 상단 메뉴는 진단하기와 AI 개선 두 개뿐이고, 나머지 화면은 화면 안의 버튼으로 들어간다.

| 화면 | 하는 일 | 데이터 (백엔드 API) |
| --- | --- | --- |
| 진단하기 (`/`) | 누가 · 무엇을 하려고 · 어느 화면을 찾아야 하는지 세 칸을 받아 진단을 시작한다 | `GET /api/health`, `POST /api/runs` |
| 진단 (`/runs/:runId`) | 진행 중에는 AI 고객이 누르는 화면을, 끝나면 같은 자리에서 결론·첫 화면 선택 가능성·지나간 길을 보인다. 클릭별 화면과 살펴볼 점은 접혀 있다. "AI에게 고쳐 달라고 하기"로 AI 개선을 시작한다 | `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues`, `POST /api/improvements` |
| AI 개선 (`/improvements`, `/improvements/:id`) | 목록은 지난 결과만 보인다(시작은 진단 화면에서만). 결과는 진행 단계 → 바꿔 볼 이름과 찾아올 가능성 → 개선안에서 다시 해 본 결과 → "나란히 비교하기" 순이고, 고른 과정은 접혀 있다 | `GET /api/improvements`, `GET /api/improvements/{id}`(진행 중이면 3초마다) |
| 지금 화면 vs 개선안 (`/comparisons/:experimentKey`) | 한 줄 결론, 양쪽 결과(몇 번 만에 도착 / 못 찾음), 지나간 길을 나란히 보인다. 화면별 상세는 접혀 있다 | `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` |

메뉴에 없고 주소로만 여는 화면: 다른 사이트 진단(`/scenario`), 메뉴 이름 후보 비교(`/optimizations`, `/optimizations/:id`), 지난 결과 다시 보기(`/replay`). `/runs/:runId/result`는 예전 주소라 진단 화면과 같다.

- 화면 이름은 `src/shared/pageNames.ts` 한 곳에서 정한다. 문구는 짧은 해요체로 쓰고, 서버 코드값·Run ID·실험 키·영어는 화면에 보이지 않는다(`src/shared/runLabels.ts` 등이 사용자 말로 바꾼다).
- 문장 검사는 BE와 같은 규칙(`src/shared/inputRules.ts`)으로 시작 전에 안내한다. 다른 진단·AI 개선·후보 비교가 돌고 있으면 시작을 막고 그 화면 링크를 보인다.
- AI 개선 결과의 출처(`kind`)는 태그로 구분한다: 사전 등록 공식 결과 / 심사위원 실행 (공식 기록 아님) / 출처 확인 안 된 결과. 확정 전·실패한 후보는 "바꿔 보세요"라고 권하지 않는다.
- 다른 사이트 진단은 링크의 도메인이 `GET /api/sites`의 `allowedHosts`에 있는 등록 사이트를 찾아 그 `siteId`로 진단한다(임시, [OI-11](docs/operations/open_issue.md#oi-11)).
- `/replay`는 고정 `experimentKey` 네 개의 저장된 Run을 조회만 한다(OI-7).
- 화면 테마는 기기 설정을 따르고 상단 바 "어둡게/밝게" 버튼으로 바꿀 수 있다.
- mock 시드: 진단 `run_mock_done_before`(도착), `run_mock_maxsteps`(못 찾음), `run_mock_invalid`(무효), `run_mock_direct_before`(직접 입력); 비교 `/comparisons/mock-done`·`mock-sitemap`·`mock-basis-mismatch`; 후보 비교 `opt_mock_completed` 등.

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
