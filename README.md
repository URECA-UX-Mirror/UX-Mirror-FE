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

흐름은 하나다: **첫 화면에서 진단 시작 → 결과 화면 하나**. 결과 화면은 네 단계가 차례로 채워진다: ① 잘 찾아가나요? → ② 왜 그랬을까요? → ③ 어떻게 바꾸면 좋을까요? → ④ 바꾸면 얼마나 좋아질까요? 상단 줄에는 로고, "새 진단", 엔진 상태, 테마 버튼만 있다.

서비스는 사용자의 사이트를 바꾸지 않는다. 주소로 사이트를 진단하고, 바꿀 메뉴 이름을 제안하고, AI가 보는 화면에서 그 이름으로 다시 해 본 결과를 보인다. 반영은 사용자가 직접 한다.

| 화면 | 하는 일 | 데이터 (백엔드 API) |
| --- | --- | --- |
| 첫 화면 (`/`) | 진단할 사이트는 시연용 예시 쇼핑몰 MORO MARKET 하나로 고정이다(첫 화면 스크린샷 미리 보기·크게 보기, #103). "무엇을 하려고 하나요?" 한 문장(예시는 서버에서 개선안이 확인된 환불 상황 세 개)을 받아 진단을 시작한다. 찾아야 할 화면은 문장의 낱말로 고르고, 못 고르면 직접 고르게 한다 | `GET /api/health`, `POST /api/runs` |
| 결과 (`/runs/:runId`) | ① 진행 중에는 AI가 누르는 화면, 끝나면 "N번 만에 찾았어요"/"못 찾았어요"와 지나간 길 ② 실제 값에서 나온 이유 한두 문장과 누를 가능성 막대 ③ "AI에게 개선안 받아 보기" → 그 자리에서 진행 단계 → 바꿀 이름 ④ 찾아올 가능성 전 → 후, 다른 목표, 개선안 화면에서 다시 해 본 결과, "화면별로 비교하기" | `GET /api/runs/{runId}`, `/steps`, `/screenshots/{stepId}`, `/issues`, `GET /api/improvements`, `POST /api/improvements`, `GET /api/improvements/{id}`(진행 중이면 3초마다) |
| 지금 화면 vs 개선안 (`/comparisons/:experimentKey`) | 한 줄 결론, 양쪽 결과(몇 번 만에 도착 / 못 찾음), 지나간 길을 나란히 보인다. 화면별 상세는 접혀 있다 | `GET /api/comparisons/{experimentKey}`, `/api/runs/{runId}`, `/steps`, `/screenshots/{stepId}` |

메뉴에 없고 주소로만 여는 화면: 받은 개선안 목록(`/improvements`), 메뉴 이름 후보 비교(`/optimizations`, `/optimizations/:id`), 지난 결과 다시 보기(`/replay`). `/improvements/:id`는 진단에서 받은 개선안이면 그 결과 화면으로 보내고, 진단 없이 만든 결과(사전 등록 공식 결과)만 ③④와 같은 모양으로 보인다. `/runs/:runId/result`는 결과 화면과 같고, `/scenario`는 첫 화면으로 보낸다.

- 고객 유형은 화면에서 묻지 않는다. API가 `persona`를 요구해 고정값 하나를 숨겨서 보낸다(임시, [OI-9](docs/operations/open_issue.md#oi-9)).
- 등록 사이트(`GET /api/sites`) 진단은 첫 화면에서 뺐다(#103, 개선안까지 되는 건 예시 쇼핑몰뿐). 서버 API는 그대로이고, 이미 있는 등록 사이트 진단 결과는 결과 화면에서 ①②까지 보인다(임시, [OI-11](docs/operations/open_issue.md#oi-11)).
- ②의 이유는 서버 값에서 확인되는 것만 말한다(멈춘 이유, 더 누른 횟수, 목표로 가는 버튼 대신 누른 버튼과 두 버튼의 가능성). 규칙은 [프론트엔드 구조](docs/architecture/frontend-structure.md)의 "이유 문장"에 있다.
- 문구는 짧은 해요체로 쓰고, 서버 코드값·Run ID·실험 키·영어는 화면에 보이지 않는다(`src/shared/runLabels.ts` 등이 사용자 말로 바꾼다).
- 문장 검사는 BE와 같은 규칙(`src/shared/inputRules.ts`)으로 시작 전에 안내한다. 다른 진단·개선안 찾기·후보 비교가 돌고 있으면 시작을 막고 그 화면 링크를 보인다.
- 개선안의 출처(`kind`)를 구분해 보인다: 사전 등록 공식 결과 / 심사위원 실행 (공식 기록 아님) / 출처 확인 안 된 결과. 확정 전·끝내지 못한 후보는 권하지 않는다.
- `/replay`는 고정 `experimentKey` 네 개의 저장된 Run을 조회만 한다(OI-7).
- 화면 테마는 기기 설정을 따르고 상단 줄의 버튼으로 바꿀 수 있다.
- mock 시드: 진단 `run_mock_done_before`(도착), `run_mock_maxsteps`(못 찾음), `run_mock_invalid`(무효), `run_mock_direct_before`(직접 입력); 비교 `/comparisons/mock-done`·`mock-sitemap`·`mock-basis-mismatch`; 후보 비교 `opt_mock_completed` 등. mock 모드에서는 개선안 받아 보기를 시작할 수 없다(실제 서버 필요).

화면별 상태 관리, 요청·응답 형식, bbox 변환은 [docs/README.md](docs/README.md)의 문서를 따른다.

## 브랜치

`main`(제출용) ← `develop`(통합) ← `유형/이슈번호-간단한 내용`(각자 작업). PR은 1명 승인 후 머지. 브랜치·커밋·Issue·PR 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

## 배포 (Vercel)

- `vercel.json`이 모든 경로를 `/index.html`로 보낸다. `BrowserRouter`를 쓰므로 `/runs/:runId` 같은 경로에서 새로고침해도 404가 나지 않는다.
- Production Branch는 `main`이다. `develop`에 push하면 Preview 배포가 만들어진다. 개발 중에는 `develop`의 Preview 주소(`<프로젝트>-git-develop-<팀>.vercel.app`)를 쓰고, 제출·심사 전에 `develop`을 `main`에 병합해 Production 주소를 쓴다.
- Vercel의 Environment Variables에 `VITE_USE_MOCK=false`와 `VITE_API_BASE_URL`을 Production과 Preview 모두 넣는다. `VITE_` 변수는 빌드 때 번들에 들어가므로 값을 바꾸면 다시 배포해야 한다. `VITE_USE_MOCK`은 값이 정확히 `true`일 때만 켜지므로 넣지 않아도 꺼진다. 값이 없으면 `VITE_API_BASE_URL`은 기본값 `http://127.0.0.1:8000`으로 빌드된다.
- 프론트는 HTTPS이므로 백엔드도 HTTPS여야 한다. 단, 백엔드를 `http://127.0.0.1`로 두면 백엔드를 띄운 PC의 브라우저에서만 동작한다. Chrome으로 열고 로컬 네트워크 접근 권한 팝업에서 허용해야 하며, 거부하면 API 요청이 모두 실패한다. Safari는 HTTPS 페이지의 `http://127.0.0.1` 요청을 혼합 콘텐츠로 막을 수 있다(브라우저 버전마다 다르므로 배포 뒤 직접 확인한다). 다른 PC에서 쓰려면 백엔드를 HTTPS 주소로 공개한다.
- 백엔드 `.env`의 `UXM_CORS_ORIGINS`에 Vercel 주소를 추가한다. 주소가 정확히 일치해야 통과하므로 Production 주소와 `develop` 브랜치 별칭 주소(`-git-develop-`)만 넣는다. 커밋별 Preview 주소와 다른 브랜치의 Preview 주소는 허용되지 않는다. 환경변수 규칙은 [로컬 환경](docs/operations/local-environment.md)을 따른다.
- 백엔드 없이 화면만 보여 줄 때는 `VITE_USE_MOCK=true`로 배포하면 mock 데이터가 나온다. Vercel은 환경변수를 Production과 Preview에 따로 둘 수 있으므로 한쪽만 `true`로 둘 수 있다.
