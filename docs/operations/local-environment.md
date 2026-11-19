# 로컬 환경

## 구성

| 구성 | 주소 | 비고 |
| --- | --- | --- |
| 프론트(Vite) | `http://localhost:5173` | `npm run dev` |
| 백엔드(FastAPI) | `http://127.0.0.1:8000` | 프론트가 호출하는 유일한 서버 |
| MORO MARKET Before | `http://127.0.0.1:8001` | 백엔드가 Playwright로 접근. 프론트는 호출하지 않음 |
| Zoro-1 GPU 서버 | 백엔드 설정(`ZORO_BASE_URL`) | 프론트에 노출하지 않음 |

8001 포트는 `UX-Mirror-BE` README(`build_shop.py`, `shop/moro-before`)에서 확인한 값이다. 프론트는 `variant=after` Run을 만들지 않으므로 변경 후 사이트를 따로 띄울 필요가 없다. FastAPI의 8000 포트는 `UX-Mirror-BE` README의 실행 명령(`uvicorn api.main:app --port 8000`)과 같다.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://127.0.0.1:8000` | 백엔드 FastAPI 주소 |
| `VITE_USE_MOCK` | `true` | `true`이면 MSW가 API 응답을 대신한다(백엔드 없이 개발). 실제 서버를 쓰려면 `false` |

- `.env.example`을 복사해 `.env`를 만든다. `.env`는 Git에 올리지 않는다.
- 값은 마지막 `/` 없이 쓴다. API 경로는 이 값에 `/api/...`를 붙여 만든다. 스크린샷 주소도 같은 방식으로 만든다.
- 변경하면 개발 서버를 다시 시작해야 반영된다.
- `.env.example`을 그대로 복사하면 `VITE_USE_MOCK=true`라 mock 데이터가 나온다. 실제 서버로 시연·확인할 때는 `false`로 바꾼다.
- `VITE_USE_MOCK`이 정확히 `true`일 때만 MSW(Mock Service Worker)가 API 응답을 대신한다. 그 밖의 값이나 미설정은 실제 백엔드를 호출한다. 이때 `public/mockServiceWorker.js`와 `src/mocks/`는 불러오지 않는다.
- mock 모드의 요청은 `VITE_API_BASE_URL`로 나가는 실제 요청처럼 개발자 도구 Network 탭에 보이고, Service Worker가 응답한다. Service Worker를 지원하지 않는 환경에서는 mock이 시작되지 않고 콘솔에 오류가 남으며, 이때 요청은 실제 서버로 나가고 헤더에 "MOCK 시작 실패 · 실제 서버로 요청 중"이 표시된다. mock이 시작되면 헤더에 "MOCK 데이터"가 표시된다.
- mock 응답 형식과 시나리오(시드 Run, 오류 재현 키)는 `src/mocks/handlers/`의 주석을 따른다.

## 비밀값 규칙

- `VITE_` 접두사가 붙은 변수는 빌드 결과(브라우저 코드)에 그대로 들어가 누구나 볼 수 있다. API 키, 토큰, 비밀번호, GPU 서버 주소를 `VITE_` 변수에 넣지 않는다.
- 프론트는 Zoro-1 GPU 서버와 통신하지 않는다. 모든 분석 요청과 결과 조회는 FastAPI를 거친다.
- 응답에 서버 경로·GPU 정보(`checkpoint`, `device`)가 있더라도 화면에 표시하지 않는다.

## CORS

- 브라우저에서 `http://localhost:5173`이 `http://127.0.0.1:8000`을 호출하면 서로 다른 출처이므로 FastAPI가 프론트 출처를 허용해야 한다. 기본 허용 출처는 `http://localhost:5173`과 `http://127.0.0.1:5173`이다.
- `localhost`와 `127.0.0.1`은 다른 출처다. 프론트는 `localhost:5173`으로 열고 백엔드 주소는 `VITE_API_BASE_URL`에 적은 값 그대로 호출한다.
- 스크린샷은 `<img>`로 표시하므로 CORS 영향을 받지 않는다. 캔버스로 읽어 가공하지 않는다.

## 서로 다른 PC에서 실행할 때

- 백엔드 PC의 `127.0.0.1`은 프론트 PC에서 접근할 수 없다. `VITE_API_BASE_URL`을 백엔드 PC의 접근 가능한 주소(예 `http://<백엔드 PC IP>:8000`)로 바꾼다. 백엔드는 모든 인터페이스에서 접속을 받아야 한다.
- 이때 프론트 출처(`http://<프론트 PC IP>:5173` 등)도 백엔드 CORS 허용 목록에 있어야 한다. 백엔드 `.env`의 `UXM_CORS_ORIGINS`에 쉼표로 출처를 추가하고, 백엔드는 `uvicorn api.main:app --host 0.0.0.0 --port 8000`으로 띄운다.
- 백엔드는 응답에 절대 주소를 담지 않는다. 이미지 주소는 경로(`/api/runs/{runId}/screenshots/{stepId}`)에 `VITE_API_BASE_URL`을 붙여 만든다.
- 방화벽에서 8000 포트를 허용해야 한다.

## Optimizer를 실제 서버로 확인할 때

- 후보 사이트 5개(`8001`~`8005`)와 모델 서버가 모두 떠 있어야 평가부터 검증, 보고서까지 한 번에 확인할 수 있다. 먼저 BE의 `scripts/check_site_instances.py`로 사이트 인스턴스를 점검한다.
- 평가·검증은 한 번에 하나만 진행하므로 다른 Run이나 Optimization이 끝난 뒤에 시작한다. 검증은 한 번만 시작할 수 있어 다시 확인하려면 새 후보 평가를 만든다.

## 실제 서버로 Run을 확인할 때

- 백엔드는 Python 3.11을 쓴다(`UX-Mirror-BE` README 기준, 3.10 미만은 문법 오류로 실행되지 않는다). `playwright install chromium`으로 브라우저를 받아야 Run이 실행된다.
- 모델 서버는 백엔드 `.env`의 `ZORO_BACKEND=http`, `ZORO_BASE_URL`, `ZORO_ENDPOINT_ID`로 정한다. 주소는 백엔드 담당에게 받으며 이 저장소 문서·`.env.example`에 적지 않는다.
- 등록 사이트 진단(첫 화면에서 등록 사이트를 고른 진단)은 외부 사이트(`cafe24-ons`)만 열면 된다. 직접 입력 Run(v1)은 MORO MARKET Before(8001)가 떠 있어야 한다. 각 `shop/moro-*` 폴더에서 `server.py`를 실행한다.
