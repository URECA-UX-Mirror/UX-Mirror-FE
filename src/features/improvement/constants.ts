/**
 * 사이드바 "자동 개선 리포트" 링크가 여는 최종 리포트 id(`public/improvements/<id>.json`).
 * 최종 `improvement.json`이 반영되기 전에는 `null`이며, 이때 링크를 보이지 않는다.
 * 샘플 id(`imp_SAMPLE_0001`)로는 연결하지 않는다. 최종 파일을 반영할 때 이 값을 채운다.
 */
export const FINAL_IMPROVEMENT_ID: string | null = null

/** 최종 리포트 화면 경로. id가 없으면 `null` */
export function finalImprovementPath(id: string | null = FINAL_IMPROVEMENT_ID): string | null {
  return id ? `/improvements/${encodeURIComponent(id)}` : null
}
