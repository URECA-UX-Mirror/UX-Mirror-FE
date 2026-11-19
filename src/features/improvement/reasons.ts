const labels: Record<string, string> = {
  TIE_LOST: '동점 후보 비교에서 탈락', NOT_BEST: '최고 점수 후보가 아님',
  MAIN_GAIN_BELOW_MIN: '주 목표 개선이 최소 기준 미달',
  MAIN_GAIN_INSUFFICIENT: '주 목표 개선이 최소 기준 미달',
  TRUNCATED_LABEL: '단어가 잘림', LABEL_TOO_LONG: '라벨이 너무 김',
  EMPTY_LABEL: '빈 이름', DUPLICATE_LABEL: '중복된 이름',
  EXISTING_LABEL: '기존 또는 이미 시도한 이름', DANGEROUS_LABEL: '위험 동작이 포함된 이름',
  INVALID_FORMAT: '이름 형식이 올바르지 않음', CANDIDATE_LIMIT_EXCEEDED: '후보 수 제한 초과',
  EVALUATION_FAILED: '평가 실패', SCORE_MISSING: '점수가 없거나 올바르지 않음',
  INVALID_CANDIDATE: '유효하지 않은 후보', GUARD_LOSS_EXCEEDED: '지킬 목표 하락으로 탈락',
  ESTIMATE_NOT_COMPLETE: '도달 확률 계산 미완료', TARGET_REACHED: '목표 점수 도달',
  NO_ADOPTION_STREAK: '연속 회차 채택 없음',
  TRUNCATED_WORD: '단어가 잘림', TOO_LONG: '라벨이 너무 김', ALREADY_TRIED: '이미 시도한 후보',
  LABEL_OVERFLOW: '라벨이 화면을 벗어남', VIEWPORT_MISMATCH: '화면 크기가 일치하지 않음',
  MODEL_TIMEOUT: '모델 응답 시간 초과', MAX_ROUNDS: '최대 회차 도달',
}

export function describeReason(code: string, goals: Record<string, string> = {}): string {
  const [kind, ...parts] = code.split(':')
  const argument = parts.join(':')
  if ((kind === 'GUARD_DROP' || kind === 'GUARD_LOSS_EXCEEDED') && argument) {
    const names = argument.split(',').map((key) => goals[key] ? `${goals[key]}(${key})` : key)
    return `지킬 목표 ${names.join(', ')} 하락으로 탈락`
  }
  if ((kind === 'INVALID_CANDIDATE' || kind === 'EVALUATION_FAILED') && argument) {
    const prefix = kind === 'INVALID_CANDIDATE' ? '유효하지 않은 후보' : '평가 실패'
    return `${prefix}: ${argument.split(',').map((item) => labels[item] ?? item).join(', ')}`
  }
  return labels[code] ?? code
}
