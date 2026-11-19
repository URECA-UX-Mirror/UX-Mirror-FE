/**
 * 사이드바 "자동 개선 리포트" 링크가 여는 최종 리포트 id(`public/improvements/<id>.json`).
 * 값이 `null`이면 링크를 보이지 않는다.
 * 최종 파일(`imp-1119b.json`, 2차 공식 실행)을 반영할 때 이 값을 채운다. 1차(`imp-1119`)는 주소로 직접 연다.
 */
export const FINAL_IMPROVEMENT_ID: string | null = 'imp-1119b'

/** 최종 리포트 화면 경로. id가 없으면 `null` */
export function finalImprovementPath(id: string | null = FINAL_IMPROVEMENT_ID): string | null {
  return id ? `/improvements/${encodeURIComponent(id)}` : null
}
