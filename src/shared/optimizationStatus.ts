/**
 * 진행 중인 메뉴 이름 후보 비교의 상태(`GET /api/health`의 `activeOptimization.status`)를 화면 문구로 바꾼다.
 * 값 목록이 열려 있으므로 모르는 값은 "진행 중"으로 보인다(오류로 만들지 않는다).
 */
export function activeOptimizationLabel(status: string): string {
  switch (status) {
    case 'CREATED':
    case 'EVALUATING':
      return '후보 평가 중'
    case 'VERIFYING':
      return '후보 검증 중'
    case 'MODEL_CALL_PENDING':
      return '모델 응답 대기 중'
    default:
      return '진행 중'
  }
}
