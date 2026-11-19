import {
  IMPROVEMENT_SCHEMA_VERSION,
  type Area,
  type ImprovementButton,
  type ImprovementCandidate,
  type ImprovementDiagnosis,
  type ImprovementGoal,
  type ImprovementOfficial,
  type ImprovementOfficialScores,
  type ImprovementPlan,
  type ImprovementReport,
  type ImprovementRound,
  type ImprovementScoreLine,
  type ImprovementScores,
  type ImprovementStop,
  type ImprovementVerification,
  type ImprovementView,
  type VerificationPair,
  type VerificationRun,
} from '../domain/improvement.ts'

// `improvement-v1` JSON을 영역별로 검증·변환한다(필수 필드 규칙은 이 파일의 검증기가 정본이다). 정적 파일이라 `src/api/dto`는 없고
// 입력은 `unknown`이다. 한 영역이 오류여도 다른 영역은 정상 변환한다. `null`은 "값 없음"이라 0으로 바꾸지 않고,
// 모르는 enum 값은 오류가 아니라 원문 문자열로 둔다.

type Obj = Record<string, unknown>

/** 필수 필드 검사 실패. 어느 필드인지 `reason`에 담아 영역 오류로 바꾼다 */
class DataError extends Error {}

const isObject = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function fail(path: string, expected: string): never {
  throw new DataError(`${path}: ${expected}이(가) 필요합니다`)
}

function reqObject(value: unknown, path: string): Obj {
  return isObject(value) ? value : fail(path, '객체')
}

function reqString(value: unknown, path: string): string {
  return typeof value === 'string' && value !== '' ? value : fail(path, '문자열')
}

function reqNumber(value: unknown, path: string): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fail(path, '숫자')
}

function reqArray(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(path, '배열')
}

/** 숫자가 아니거나 `NaN`이면 `null`. 0으로 바꾸지 않는다 */
const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const stringOrNull = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

const boolOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

/** 필수 점수 표(`{S2: 0.8}`). 객체가 아니거나 숫자가 아닌 값(`null` 포함)이 섞이면 필수 규칙 위반(`DataError`)이다 */
function reqScoreMap(value: unknown, path: string): Record<string, number> {
  const source = reqObject(value, path)
  const result: Record<string, number> = {}
  for (const [key, score] of Object.entries(source)) {
    result[key] = reqNumber(score, `${path}.${key}`)
  }
  return result
}

function optionalScoreMap(value: unknown): Record<string, number> | null {
  if (!isObject(value)) return null
  const result: Record<string, number> = {}
  for (const [key, score] of Object.entries(value)) {
    const parsed = numberOrNull(score)
    if (parsed !== null) result[key] = parsed
  }
  return result
}

function area<T>(convert: () => T): Area<T> {
  try {
    return { ok: true, data: convert() }
  } catch (error) {
    if (error instanceof DataError) return { ok: false, reason: error.message }
    throw error
  }
}

// ── 영역 1: report(summary) ──────────────────────────────────────────

function toScoreLine(
  value: unknown,
  path: string,
  improved: boolean,
): ImprovementScoreLine {
  const line = reqObject(value, path)
  const before = reqNumber(line.before, `${path}.before`)
  return {
    // `_required`에 없는 필드라 없어도 영역 오류로 만들지 않는다
    goalKey: stringOrNull(line.goalKey),
    name: stringOrNull(line.name),
    before,
    // 개선했으면 필수, 아니면 요구하지 않고 값이 없으면 `null`로 둔다
    after: improved ? reqNumber(line.after, `${path}.after`) : numberOrNull(line.after),
    delta: improved ? reqNumber(line.delta, `${path}.delta`) : numberOrNull(line.delta),
  }
}

export function toImprovementReport(json: unknown): ImprovementReport {
  const root = reqObject(json, '(root)')
  const schemaVersion = reqString(root.schemaVersion, 'schemaVersion')
  if (schemaVersion !== IMPROVEMENT_SCHEMA_VERSION) {
    fail('schemaVersion', `"${IMPROVEMENT_SCHEMA_VERSION}"`)
  }
  const summary = reqObject(root.summary, 'summary')
  const result = reqString(summary.result, 'summary.result')
  const improved = result === 'IMPROVED'
  const target = isObject(summary.target) ? summary.target : null
  return {
    schemaVersion,
    improvementId: reqString(root.improvementId, 'improvementId'),
    status: reqString(root.status, 'status'),
    createdAt: stringOrNull(root.createdAt),
    finishedAt: stringOrNull(root.finishedAt),
    result,
    target: target && {
      pageKey: stringOrNull(target.pageKey),
      semanticKey: stringOrNull(target.semanticKey),
      region: stringOrNull(target.region),
    },
    beforeLabel: reqString(summary.beforeLabel, 'summary.beforeLabel'),
    afterLabel: improved
      ? reqString(summary.afterLabel, 'summary.afterLabel')
      : stringOrNull(summary.afterLabel),
    afterSource: stringOrNull(summary.afterSource),
    roundsRun: numberOrNull(summary.roundsRun),
    main: toScoreLine(summary.main, 'summary.main', improved),
    guards: reqArray(summary.guards, 'summary.guards').map((guard, index) =>
      toScoreLine(guard, `summary.guards[${index}]`, improved),
    ),
    scoreSource: stringOrNull(summary.scoreSource),
    headline: stringOrNull(summary.headline),
    officialRejected: isObject(summary.officialRejected)
      ? {
          label: stringOrNull(summary.officialRejected.label),
          reason: stringOrNull(summary.officialRejected.reason),
        }
      : null,
  }
}

// ── 영역 2: official ────────────────────────────────────────────────

function toScores(value: unknown, path: string): ImprovementScores {
  const scores = reqObject(value, path)
  return {
    mainScore: reqNumber(scores.mainScore, `${path}.mainScore`),
    guardScores: reqScoreMap(scores.guardScores, `${path}.guardScores`),
  }
}

function scoresOrNull(value: unknown): ImprovementScores | null {
  const result = area(() => toScores(value, 'official.scoresA'))
  return result.ok ? result.data : null
}

/** 점수 또는 `null`. BE는 B 점수를 모으지 못하면 `null`을 저장하므로 `null`은 값 없음이고, 숫자·`null`이 아니면 형식 오류다 */
function reqScoreOrNull(value: unknown, path: string): number | null {
  return value === null ? null : reqNumber(value, path)
}

function toOfficialScores(value: unknown): ImprovementOfficialScores {
  const scores = reqObject(value, 'official.scores')
  const guards = reqObject(scores.guardScores, 'official.scores.guardScores')
  return {
    mainScore: reqScoreOrNull(scores.mainScore, 'official.scores.mainScore'),
    guardScores: Object.fromEntries(
      Object.entries(guards).map(([key, score]) => [
        key,
        reqScoreOrNull(score, `official.scores.guardScores.${key}`),
      ]),
    ),
  }
}

/** B 평가에서 탈락한 사유. BE `choose.rejected[0]`의 `reason`에 탈락한 지킬 목표를 `:S4`로 붙인다 */
function officialRejectedReason(choose: Record<string, unknown> | null): string | null {
  const first = choose && Array.isArray(choose.rejected) ? choose.rejected[0] : null
  if (!isObject(first) || typeof first.reason !== 'string') return null
  const goals = Array.isArray(first.guardGoals) ? stringList(first.guardGoals) : []
  return goals.length > 0 ? `${first.reason}:${goals.join(',')}` : first.reason
}

/** `official`이 `null`이면 공식 평가 전이다. 키가 아예 없으면 형식 오류다 */
export function toImprovementOfficial(value: unknown): ImprovementOfficial | null {
  if (value === null) return null
  const official = reqObject(value, 'official')
  const site = isObject(official.site) ? official.site : null
  const choose = isObject(official.choose) ? official.choose : null
  return {
    method: stringOrNull(official.method),
    label: reqString(official.label, 'official.label'),
    siteLabel: site ? stringOrNull(site.siteLabel) : null,
    buildCheck: site ? stringOrNull(site.buildCheck) : null,
    scores: toOfficialScores(official.scores),
    // 참고용 A 방식 점수라 형식이 다르면 영역 오류 대신 `null`로 둔다
    scoresA: isObject(official.scoresA) ? scoresOrNull(official.scoresA) : null,
    maxDiffAvsB: numberOrNull(official.maxDiffAvsB),
    decision: stringOrNull(official.decision),
    rejectedReason: officialRejectedReason(choose),
  }
}

// ── 영역 3: rounds ──────────────────────────────────────────────────

function toButton(value: unknown): ImprovementButton | null {
  if (!isObject(value)) return null
  return {
    semanticKey: stringOrNull(value.semanticKey),
    label: stringOrNull(value.label),
    region: stringOrNull(value.region),
    probability: numberOrNull(value.probability),
  }
}

function toDiagnosis(value: unknown): ImprovementDiagnosis | null {
  if (!isObject(value)) return null
  return {
    bottleneckPage: stringOrNull(value.bottleneckPage),
    blockScore: numberOrNull(value.blockScore),
    targetButton: toButton(value.targetButton),
    rivalButton: toButton(value.rivalButton),
    text: stringOrNull(value.text),
  }
}

function toCandidate(value: unknown, path: string): ImprovementCandidate {
  const candidate = reqObject(value, path)
  const layout = isObject(candidate.layout) ? candidate.layout : null
  return {
    candidateId: reqString(candidate.candidateId, `${path}.candidateId`),
    label: reqString(candidate.label, `${path}.label`),
    source: stringOrNull(candidate.source),
    order: numberOrNull(candidate.order),
    method: stringOrNull(candidate.method),
    evaluationStatus: stringOrNull(candidate.evaluationStatus),
    layoutValid: layout ? boolOrNull(layout.valid) : null,
    layoutReasons: layout ? stringList(layout.reasons) : [],
    // 평가 실패·건너뜀이면 `null`이고 0으로 바꾸지 않는다
    mainScore: numberOrNull(candidate.mainScore),
    guardScores: optionalScoreMap(candidate.guardScores),
    decision: reqString(candidate.decision, `${path}.decision`),
    reason: stringOrNull(candidate.reason),
  }
}

function toRound(value: unknown, path: string): ImprovementRound {
  const round = reqObject(value, path)
  const baseline = isObject(round.baseline) ? round.baseline : null
  const proposal = isObject(round.proposal) ? round.proposal : null
  return {
    round: reqNumber(round.round, `${path}.round`),
    diagnosis: toDiagnosis(round.diagnosis),
    baseline: baseline && {
      label: stringOrNull(baseline.label),
      mainScore: numberOrNull(baseline.mainScore),
      guardScores: optionalScoreMap(baseline.guardScores),
    },
    proposal:
      proposal && Array.isArray(proposal.filtered)
        ? proposal.filtered.filter(isObject).flatMap((item) =>
            typeof item.label === 'string'
              ? [
                  {
                    label: item.label,
                    accepted: item.accepted === true,
                    rejectedReason: stringOrNull(item.rejectedReason),
                  },
                ]
              : [],
          )
        : [],
    candidates: reqArray(round.candidates, `${path}.candidates`).map((item, index) =>
      toCandidate(item, `${path}.candidates[${index}]`),
    ),
    adopted: stringOrNull(round.adopted),
  }
}

export function toImprovementRounds(value: unknown): ImprovementRound[] {
  return reqArray(value, 'rounds').map((item, index) => toRound(item, `rounds[${index}]`))
}

// ── 영역 4: verification ────────────────────────────────────────────

function toVerificationRun(value: unknown, path: string): VerificationRun | null {
  if (value === null) return null
  const run = reqObject(value, path)
  return {
    label: stringOrNull(run.label),
    variant: stringOrNull(run.variant),
    runId: stringOrNull(run.runId),
    resultPath: stringOrNull(run.resultPath),
    progressPath: stringOrNull(run.progressPath),
    status: stringOrNull(run.status),
    validity: stringOrNull(run.validity),
    goalReached: boolOrNull(run.goalReached),
    path: stringList(run.path),
    stepCount: numberOrNull(run.stepCount),
    issues: stringList(run.issues),
    resultOrigin: stringOrNull(run.resultOrigin),
    modelEndpointId: stringOrNull(run.modelEndpointId),
  }
}

function toPair(value: unknown, path: string): VerificationPair {
  const pair = reqObject(value, path)
  return {
    // `_required`에 없는 필드라 없어도 영역 오류로 만들지 않는다
    goalKey: stringOrNull(pair.goalKey),
    name: stringOrNull(pair.name),
    experimentKey: stringOrNull(pair.experimentKey),
    comparisonPath: stringOrNull(pair.comparisonPath),
    // 키가 없으면(`undefined`) Run을 만들지 못한 것으로 읽는다
    before: toVerificationRun(pair.before ?? null, `${path}.before`),
    after: toVerificationRun(pair.after ?? null, `${path}.after`),
  }
}

export function toImprovementVerification(value: unknown): ImprovementVerification {
  const verification = reqObject(value, 'verification')
  const error = isObject(verification.error) ? verification.error : null
  return {
    status: reqString(verification.status, 'verification.status'),
    error: error && {
      code: stringOrNull(error.code),
      message: stringOrNull(error.message),
    },
    method: stringOrNull(verification.method),
    pairs: reqArray(verification.pairs, 'verification.pairs').map((item, index) =>
      toPair(item, `verification.pairs[${index}]`),
    ),
  }
}

// ── 필수 영역이 아닌 값 ─────────────────────────────────────────────

function toStop(value: unknown): ImprovementStop | null {
  if (!isObject(value)) return null
  return { reason: stringOrNull(value.reason), detail: stringOrNull(value.detail) }
}

function toGoal(value: unknown): ImprovementGoal | null {
  if (!isObject(value) || typeof value.goalKey !== 'string') return null
  return {
    goalKey: value.goalKey,
    name: stringOrNull(value.name),
    goal: stringOrNull(value.goal),
    goalPage: stringOrNull(value.goalPage),
    shortestSteps: numberOrNull(value.shortestSteps),
  }
}

function toPlan(value: unknown): ImprovementPlan | null {
  if (!isObject(value)) return null
  const site = isObject(value.site) ? value.site : null
  return {
    improvementPlanId: stringOrNull(value.improvementPlanId),
    persona: stringOrNull(value.persona),
    mainGoal: toGoal(value.mainGoal),
    guardGoals: Array.isArray(value.guardGoals)
      ? value.guardGoals.flatMap((goal) => toGoal(goal) ?? [])
      : [],
    site: site && {
      siteId: stringOrNull(site.siteId),
      variant: stringOrNull(site.variant),
      name: stringOrNull(site.name),
    },
    rules: isObject(value.rules) ? value.rules : null,
    model: isObject(value.model) ? value.model : null,
  }
}

/**
 * `improvement.json` 전체를 영역별로 변환한다. 입력이 객체가 아니면 네 영역이 모두 오류다.
 * 한 영역이 오류여도 다른 영역은 정상 변환한다.
 */
export function toImprovementView(json: unknown): ImprovementView {
  const root = isObject(json) ? json : null
  return {
    report: area(() => toImprovementReport(json)),
    official: area(() =>
      toImprovementOfficial(reqObject(root, '(root)').official),
    ),
    rounds: area(() => toImprovementRounds(reqObject(root, '(root)').rounds)),
    verification: area(() =>
      toImprovementVerification(reqObject(root, '(root)').verification),
    ),
    stop: root ? toStop(root.stop) : null,
    plan: root ? toPlan(root.plan) : null,
    limitations: root ? stringOrNull(root.limitations) : null,
    meta: {
      status: root ? stringOrNull(root.status) : null,
      createdAt: root ? stringOrNull(root.createdAt) : null,
    },
  }
}
