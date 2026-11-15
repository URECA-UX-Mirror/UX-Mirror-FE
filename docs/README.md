# 프로젝트 문서

이 디렉터리는 프론트엔드가 백엔드와 연동하기 위해 필요한 구조·계약·환경 정보를 책임별로 나눈다. 문서는 원칙적으로 300줄 이하로 유지한다. 화면 목록과 실행 방법은 루트 [README](../README.md)에 있다.

| 영역 | 문서 | 설명 |
| --- | --- | --- |
| 구조 | [프론트엔드 구조](architecture/frontend-structure.md) | 화면별 사용 API·상태 관리, 데이터 출처 구분, Adapter 계층, 폴더 구조 |
| 계약 | [REST API](contracts/rest-api.md) | endpoint별 요청·응답·상태 코드·빈 데이터 처리 |
| 계약 | [데이터 모델](contracts/data-model.md) | Run·Step·Candidate·Issue·Comparison 타입과 식별자 정책 |
| 계약 | [실행 상태와 폴링](contracts/run-lifecycle.md) | 상태값, 폴링 시작·중단, 새로고침 복원 |
| 계약 | [스크린샷과 bbox](contracts/screenshot-bbox.md) | 이미지 표시와 bbox 좌표 변환 |
| 계약 | [지표와 목표 판정](contracts/metrics-and-goal.md) | 지표 의미, 목표 도달 판정, 프론트의 책임 범위 |
| 운영 | [로컬 환경](operations/local-environment.md) | 포트, 환경변수, CORS, 비밀값 규칙 |
| 운영 | [미결정 항목](operations/open_issue.md) | 확정 전 항목과 담당 역할별 확인 내용 |
| 규칙 | [저장소 작업 지침](../AGENTS.md) | 읽기 범위, 문서·테스트·Git 규칙 |

## 표기 규칙

계약 문서는 아래 표기로 근거를 구분한다.

| 표기 | 의미 |
| --- | --- |
| `BE 확인` | `UX-Mirror-BE`의 코드나 저장된 결과 파일에서 확인한 값 |
| `임시` | 프론트가 먼저 정한 계약. 확정 전까지 바뀔 수 있으며 `OI-n`으로 [미결정 항목](operations/open_issue.md)에 연결된다 |
| `P1` | 현재 구현 범위(P0) 밖. 구현된 기능으로 취급하지 않는다 |

JSON 예시는 `예시(임시)`와 `실측(파일명)`으로 구분해 표시한다. 백엔드에는 아직 FastAPI endpoint 코드가 없으므로 모든 endpoint 형식은 `임시`다.
