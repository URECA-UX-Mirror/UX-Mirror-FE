# 자동 개선 결과 JSON 반영 절차

자동 개선 리포트가 읽는 `public/improvements/<improvementId>.json`을 최종본으로 바꿔 배포하는 절차다. 형식과 임시 결정은 [OI-13](open_issue.md#oi-13), 화면 동작은 [프론트엔드 구조](../architecture/frontend-structure.md)의 "8. 자동 개선 리포트"를 따른다.

## 반영 절차

1. 정자비에게 전달받은 JSON을 아래 "공개 전 검사"로 확인한다.
2. `public/improvements/<id>.json`에 넣는다. 샘플(`imp_SAMPLE_0001.json`)은 지우지 않는다.
3. 사이드바 링크가 최종본을 열도록 `src/features/improvement/constants.ts`의 `FINAL_IMPROVEMENT_ID`를 `<id>`로 채운다. 값이 `null`이면 링크는 보이지 않는다.
4. `npm test`, `npm run lint`, `npm run build`, `git diff --check`를 실행하고 PR을 만든다(대상 `develop`).
5. 머지 뒤 Vercel이 `develop`을 다시 배포하면 Preview 주소에서 확인한다. 제출·심사용 Production은 `develop`을 `main`에 병합한 뒤 확인한다([README](../../README.md)의 "배포").
6. 배포 주소에서 확인한다.
   - `/improvements/<id>.json`이 JSON으로 열린다(HTML이 나오면 안 된다).
   - `/improvements/<id>`가 리포트 화면으로 열리고 네 영역 중 "데이터 오류"가 없다.
   - 사이드바의 "자동 개선 리포트" 링크가 같은 화면을 연다.
   - 이전 내용이 보이면 브라우저 캐시일 수 있으므로 강력 새로고침이나 시크릿 창으로 다시 확인한다.

## 공개 전 검사

저장소가 공개라 JSON은 그대로 노출된다. 백엔드 `scripts/export_run_logs.py`의 `SECRET_PATTERNS`와 같은 기준으로 확인한다.

- 사설·서버 IP나 포트가 붙은 주소(`http://10.x.x.x`, `https://host:8000` 등)가 없다. `127.0.0.1`·`localhost`는 이 스크립트가 허용하지만 이 JSON에는 넣지 않는다.
- `/Users/`, `/home/`, `C:\Users\` 같은 로컬·서버 경로가 없다. 화면 경로(`path`)의 웹 주소는 예외다.
- API 키·토큰·비밀번호 값이 없다.
- `schemaVersion`이 `improvement-v1`이고 `sample`이 `true`가 아니다.
- 화면에서 네 영역(개선 효과·실제 검증·공식 평가·회차)이 모두 "데이터 오류" 없이 열린다. 영역 오류는 해당 영역에만 사유로 표시되므로 개발 서버에서 `/improvements/<id>`를 직접 열어 확인한다.
