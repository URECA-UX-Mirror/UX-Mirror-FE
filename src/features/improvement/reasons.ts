/** 후보가 떨어진 이유·멈춘 이유 (BE 사유 코드 → 사람 말). 화면에는 코드를 보이지 않는다 */
const labels: Record<string, string> = {
  TIE_LOST: '비슷한 후보에 밀렸어요',
  NOT_BEST: '더 나은 후보가 있었어요',
  MAIN_GAIN_INSUFFICIENT: '나아진 폭이 작았어요',
  TRUNCATED_LABEL: '글자가 잘려요',
  LABEL_TOO_LONG: '이름이 너무 길어요',
  EMPTY_LABEL: '이름이 비었어요',
  DUPLICATE_LABEL: '겹치는 이름이에요',
  EXISTING_LABEL: '이미 써 본 이름이에요',
  DANGEROUS_LABEL: '위험한 동작이 들어 있어요',
  INVALID_FORMAT: '이름 모양이 맞지 않아요',
  CANDIDATE_LIMIT_EXCEEDED: '후보가 너무 많았어요',
  EVALUATION_FAILED: '점수를 내지 못했어요',
  SCORE_MISSING: '점수가 없어요',
  INVALID_CANDIDATE: '쓸 수 없는 후보예요',
  GUARD_LOSS_EXCEEDED: '다른 목표가 많이 떨어졌어요',
  ESTIMATE_NOT_COMPLETE: '계산을 끝내지 못했어요',
  TARGET_REACHED: '목표 점수에 닿았어요',
  NO_ADOPTION_STREAK: '여러 번 연달아 고를 이름이 없었어요',
  LABEL_OVERFLOW: '글자가 화면 밖으로 나가요',
  VIEWPORT_MISMATCH: '화면 크기가 달라요',
  MODEL_TIMEOUT: 'AI 응답이 늦었어요',
  MAX_ROUNDS: '정한 횟수를 다 해 봤어요',
}

const OTHER = '다른 이유가 있었어요'

/** `goals`: 목표 키(`S4` 등) → 이름(`문의`). 모르는 키는 이름 없이 "다른 목표"로 말한다 */
export function describeReason(code: string, goals: Record<string, string> = {}): string {
  const [kind, ...parts] = code.split(':')
  const argument = parts.join(':')
  if (kind === 'GUARD_LOSS_EXCEEDED' && argument) {
    const names = argument.split(',').map((key) => goals[key]).filter(Boolean)
    return names.length ? `${names.join('·')} 쪽이 많이 떨어졌어요` : labels.GUARD_LOSS_EXCEEDED
  }
  if ((kind === 'INVALID_CANDIDATE' || kind === 'EVALUATION_FAILED') && argument) {
    const details = argument.split(',').map((item) => labels[item]).filter(Boolean)
    return details.length ? `${labels[kind]} (${details.join(', ')})` : labels[kind]
  }
  return labels[code] ?? OTHER
}
