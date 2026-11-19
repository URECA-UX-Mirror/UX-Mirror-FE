/** 화면 이름. 메뉴·제목·안내 문장이 모두 이 값을 쓴다 (한 곳만 바꾸면 모든 화면이 바뀐다) */
export const PAGE_NAMES = {
  diagnose: '진단하기',
  improvement: 'AI 개선',
  run: '진단',
  comparison: '지금 화면 vs 개선안',
  // 메뉴에는 없고 주소로만 여는 화면
  otherSite: '다른 사이트 진단',
  replay: '지난 결과 다시 보기',
  optimizer: '메뉴 이름 후보 비교',
  optimizerDetail: '후보 비교 결과',
  // 예전 이름 (진단 진행·결과는 한 화면으로 합쳤다)
  progress: '진단',
  result: '진단',
} as const
