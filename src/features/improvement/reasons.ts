const labels: Record<string, string> = {
  TIE_LOST: '동점 후보 비교에서 탈락', NOT_BEST: '최고 점수 후보가 아님',
  MAIN_GAIN_BELOW_MIN: '주 목표 개선이 최소 기준 미달',
  TRUNCATED_WORD: '단어가 잘림', TOO_LONG: '라벨이 너무 김', ALREADY_TRIED: '이미 시도한 후보',
  LABEL_OVERFLOW: '라벨이 화면을 벗어남', VIEWPORT_MISMATCH: '화면 크기가 일치하지 않음',
  MODEL_TIMEOUT: '모델 응답 시간 초과', MAX_ROUNDS: '최대 회차 도달',
}

export function describeReason(code: string, goals: Record<string, string> = {}): string {
  const [kind, ...parts] = code.split(':')
  const argument = parts.join(':')
  if (kind === 'GUARD_DROP' && argument) return `지킬 목표 ${goals[argument] ? `${goals[argument]}(${argument})` : argument} 하락으로 탈락`
  if ((kind === 'INVALID_CANDIDATE' || kind === 'EVALUATION_FAILED') && argument) {
    const prefix = kind === 'INVALID_CANDIDATE' ? '유효하지 않은 후보' : '평가 실패'
    return `${prefix}: ${labels[argument] ?? argument}`
  }
  return labels[code] ?? code
}
