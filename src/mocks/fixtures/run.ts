import type {
  IssueListDto,
  PathVisitDto,
  RunDto,
  RunSummaryDto,
  StepDto,
} from '../../api/dto/index.ts'
import type { RunRecord } from '../store.ts'
import {
  GOAL,
  PAGES,
  PERSONAS,
  STEP_PAGES,
  VIEWPORT,
  getChoices,
  type PageKey,
} from './scenario.ts'

/** 생성 후 첫 Step이 시작되기까지(READY 구간) */
export const START_MS = 1000
/** Step 하나가 저장되기까지 걸리는 시간 */
export const STEP_MS = 2000
/** 종료 후 `/issues`가 `PENDING`으로 남아 있는 시간 */
export const ISSUE_DELAY_MS = 3000

const SCHEMA_VERSION = '1.3.2'
const iso = (ms: number) => new Date(ms).toISOString()
const round = (value: number) => Math.round(value * 10000) / 10000

export interface Timing {
  totalSteps: number
  doneSteps: number
  started: boolean
  terminal: boolean
  finishedAtMs: number
}

/** 이 Run에서 실제로 실행되는 Step 수. 시나리오 단계 수와 `maxSteps` 중 작은 값이다. */
export function stepLimit(rec: RunRecord): number {
  return Math.min(STEP_PAGES[rec.variant].length, Math.max(1, rec.maxSteps))
}

/** `maxSteps`에 먼저 도달해 목표 화면에 도착하지 못하고 끝나는 Run인지 */
export function isMaxStepsStopped(rec: RunRecord): boolean {
  return rec.maxSteps < STEP_PAGES[rec.variant].length
}

/** 마지막 Step 뒤에 도착하는 화면. 목표에 도달했으면 `refund`다. Step이 없는 화면이다(OI-3). */
function arrivalPage(rec: RunRecord): PageKey {
  if (!isMaxStepsStopped(rec)) return 'refund'
  const lastPage = STEP_PAGES[rec.variant][stepLimit(rec) - 1]
  const choices = getChoices(rec.variant, lastPage)
  return choices.candidates.find((c) => c.optionId === choices.selectedOptionId)!
    .leadsTo
}

export function getTiming(rec: RunRecord, nowMs: number): Timing {
  const totalSteps = stepLimit(rec)
  const elapsed = nowMs - rec.createdAtMs
  const finishedElapsed = START_MS + totalSteps * STEP_MS
  const done = Math.floor((elapsed - START_MS) / STEP_MS)
  return {
    totalSteps,
    doneSteps: Math.min(totalSteps, Math.max(0, done)),
    started: elapsed >= START_MS,
    terminal: elapsed >= finishedElapsed,
    finishedAtMs: rec.createdAtMs + finishedElapsed,
  }
}

// ---- 지표 계산(Step.decision) ----

function entropy(probabilities: number[]): number | null {
  if (probabilities.length < 2) return null
  const total = probabilities.reduce((sum, p) => sum + p, 0)
  const h = probabilities.reduce(
    (sum, p) => (p > 0 ? sum - (p / total) * Math.log(p / total) : sum),
    0,
  )
  return round(h / Math.log(probabilities.length))
}

function top2Margin(probabilities: number[]): number | null {
  if (probabilities.length < 2) return null
  const sorted = [...probabilities].sort((a, b) => b - a)
  return round(sorted[0] - sorted[1])
}

function normalize(probabilities: number[]): number[] {
  const total = probabilities.reduce((sum, p) => sum + p, 0)
  return probabilities.map((p) => p / total)
}

// ---- Step ----

export function buildSteps(rec: RunRecord, count: number): StepDto[] {
  const pages = STEP_PAGES[rec.variant].slice(0, stepLimit(rec))
  const steps: StepDto[] = []
  for (let i = 0; i < Math.min(count, pages.length); i += 1) {
    const stepId = i + 1
    const pageKey = pages[i]
    const choices = getChoices(rec.variant, pageKey)
    const selected = choices.candidates.find(
      (c) => c.optionId === choices.selectedOptionId,
    )!
    const clickProbabilities = choices.candidates.map((c) => c.probability)
    const all =
      choices.goBackProbability === null
        ? clickProbabilities
        : [...clickProbabilities, choices.goBackProbability]
    // 허용 경로로 이어지는 후보가 없으면 null이다. 0으로 바꾸지 않는다(metrics-and-goal.md).
    const goalPathCandidates = choices.candidates.filter((c) => c.onGoalPath)
    const goalPathProbability =
      goalPathCandidates.length === 0
        ? null
        : round(goalPathCandidates.reduce((sum, c) => sum + c.probability, 0))
    const startedMs = rec.createdAtMs + START_MS + i * STEP_MS
    const nextPath = PAGES[selected.leadsTo].path

    steps.push({
      schemaVersion: SCHEMA_VERSION,
      runId: rec.runId,
      stepId,
      timestamp: iso(startedMs + STEP_MS),
      page: {
        pageKey,
        pageSignature: `sig_${pageKey}`,
        path: PAGES[pageKey].path,
        title: PAGES[pageKey].title,
        viewport: VIEWPORT,
        screenshotSize: VIEWPORT,
        scroll: { x: 0, y: 0 },
        screenshotRef: `mock/${rec.runId}/step_${stepId}.png`,
        overlayScreenshotRef: null,
        capturedAt: iso(startedMs),
      },
      candidateSet: {
        candidateSetId: `cs_${pageKey}`,
        candidateSetChanged: true,
        candidateScope: ['viewport'],
        actionSetIncludesBack: choices.backOptionId !== null,
        backOptionId: choices.backOptionId,
        candidates: choices.candidates.map((c) => ({
          optionId: c.optionId,
          label: c.label,
          region: c.region,
          context: null,
          bbox: c.bbox,
          semanticKey: c.semanticKey,
          actionType: 'CLICK',
          probability: c.probability,
          selected: c.optionId === choices.selectedOptionId,
        })),
      },
      decision: {
        selectedOptionId: selected.optionId,
        selectedActionType: 'CLICK',
        resultOrigin: 'MOCK',
        goalJudgmentMode: 'DOM_ONLY',
        modelGoalReached: null,
        modelGoalYesProb: null,
        verifiedGoalReached: false,
        goalJudgmentMismatch: false,
        normalizedEntropy: entropy(all),
        clickOnlyNormalizedEntropy: entropy(normalize(clickProbabilities)),
        goBackProbability: choices.goBackProbability,
        top2Margin: top2Margin(all),
        clickOnlyTop2Margin: top2Margin(normalize(clickProbabilities)),
        goalPathProbability,
        modelLatencyMs: 800 + i * 120,
        metricWarnings: [],
      },
      action: {
        selectedOptionId: selected.optionId,
        executedOptionId: selected.optionId,
        actionType: 'CLICK',
        eventOrigin: 'MODEL_DECISION',
        result: 'NAVIGATED',
        reason: null,
        executed: true,
        fromPath: PAGES[pageKey].path,
        toPath: nextPath,
        startedAt: iso(startedMs + 1200),
        finishedAt: iso(startedMs + STEP_MS),
        error: null,
      },
      statusAfterStep:
        i === pages.length - 1
          ? isMaxStepsStopped(rec)
            ? 'MAX_STEPS'
            : 'SUCCESS'
          : 'RUNNING',
      error: null,
    })
  }
  return steps
}

// ---- Run ----

function buildPath(rec: RunRecord): PathVisitDto[] {
  const pages = STEP_PAGES[rec.variant].slice(0, stepLimit(rec))
  const visited: PageKey[] = [...pages, arrivalPage(rec)]
  return visited.map((pageKey, sequence) => ({
    sequence,
    pageKey,
    pageSignature: `sig_${pageKey}`,
    path: PAGES[pageKey].path,
    enteredBy: sequence === 0 ? null : 'CLICK',
    visitCause: sequence === 0 ? 'RUN_START' : 'MODEL_NAVIGATION',
    // 도착 화면에는 Step이 없다(OI-3)
    stepId: sequence < pages.length ? sequence + 1 : null,
  }))
}

export function buildSummary(rec: RunRecord): RunSummaryDto {
  const stepCount = stepLimit(rec)
  const stopped = isMaxStepsStopped(rec)
  const extra = rec.variant === 'before' ? 1 : 0
  return {
    goalReached: !stopped,
    stepCount,
    stepRecordCount: stepCount,
    modelCallCount: stepCount,
    clickCount: stepCount,
    successfulNavigationClickCount: stepCount,
    modelBackCount: 0,
    systemBackCount: 0,
    backCount: 0,
    revisitCount: 0,
    referencePathDeviationCount: extra,
    navigationCost: stepCount,
    // 목표에 도달하지 못하면 extraSteps 계열은 null이다(계약 §6.4)
    extraSteps: stopped ? null : extra,
    extraNavigationCost: stopped ? null : extra,
    attemptedExtraSteps: stopped ? null : extra,
    executionTimeMs: stepCount * STEP_MS,
    path: buildPath(rec),
    detectedIssueTypes: stopped
      ? ['GOAL_NOT_REACHED']
      : rec.variant === 'before'
        ? ['CHOICE_AMBIGUITY', 'EXTRA_STEPS']
        : [],
  }
}

export function buildRun(rec: RunRecord, nowMs: number): RunDto {
  const timing = getTiming(rec, nowMs)
  const persona =
    PERSONAS.find((p) => p.personaId === rec.personaId) ?? PERSONAS[0]
  const pages = STEP_PAGES[rec.variant]
  const stopped = isMaxStepsStopped(rec)
  const status = timing.terminal
    ? stopped
      ? 'MAX_STEPS'
      : 'SUCCESS'
    : timing.started
      ? 'RUNNING'
      : 'READY'
  const currentPageKey = timing.terminal
    ? arrivalPage(rec)
    : timing.started
      ? pages[timing.doneSteps]
      : null

  return {
    schemaVersion: SCHEMA_VERSION,
    runId: rec.runId,
    experimentKey: rec.experimentKey,
    variant: rec.variant,
    resultOrigin: 'MOCK',
    modelVersion: null,
    promptVersion: 'mock',
    temperature: 0,
    goalJudgmentMode: 'DOM_ONLY',
    goalId: rec.goalId,
    goal: GOAL.goal,
    personaId: persona.personaId,
    persona: persona.persona,
    startPath: '/',
    viewport: VIEWPORT,
    limits: {
      maxSteps: rec.maxSteps,
      modelTimeoutMs: 30000,
      runTimeoutMs: 300000,
    },
    status,
    createdAt: iso(rec.createdAtMs),
    startedAt: timing.started ? iso(rec.createdAtMs + START_MS) : null,
    finishedAt: timing.terminal ? iso(timing.finishedAtMs) : null,
    terminationReason: timing.terminal
      ? stopped
        ? 'MAX_STEPS_REACHED' // 가정한 코드(OI-9)
        : 'GOAL_REACHED'
      : null,
    progress: {
      stepRecordCount: timing.doneSteps,
      stepCount: timing.doneSteps,
      maxSteps: rec.maxSteps,
      currentPageKey,
      lastUpdatedAt: timing.started
        ? iso(rec.createdAtMs + START_MS + timing.doneSteps * STEP_MS)
        : null,
    },
    summary: timing.terminal ? buildSummary(rec) : null,
    error: null,
    validity: timing.terminal ? (rec.invalid ? 'INVALID' : 'VALID') : null,
    invalidReason: timing.terminal && rec.invalid ? 'MOCK_INVALID_RUN' : null,
    replacementRunId: rec.replacementRunId ?? null,
  }
}

// ---- Issue ----

export function buildIssues(rec: RunRecord, nowMs: number): IssueListDto {
  const timing = getTiming(rec, nowMs)
  const ready = timing.terminal && nowMs >= timing.finishedAtMs + ISSUE_DELAY_MS
  if (!ready) {
    return { runId: rec.runId, analysisStatus: 'PENDING', items: [] }
  }
  if (isMaxStepsStopped(rec) && !rec.invalid) {
    const createdAt = iso(timing.finishedAtMs + ISSUE_DELAY_MS)
    const lastStepId = stepLimit(rec)
    return {
      runId: rec.runId,
      analysisStatus: 'COMPLETED',
      items: [
        {
          schemaVersion: SCHEMA_VERSION,
          issueId: `issue_${rec.runId}_1`,
          runId: rec.runId,
          issueType: 'GOAL_NOT_REACHED',
          stepId: lastStepId,
          relatedStepIds: [lastStepId],
          pagePath: null,
          pageKey: null,
          pageSignature: null,
          title: '최대 탐색 횟수 안에 목표에 도달하지 못함',
          description: '정해진 횟수 안에 목표 화면에 도착하지 못했습니다.',
          evidence: { maxSteps: rec.maxSteps },
          reviewPriority: 'PRIORITY_REVIEW',
          occurrenceCount: 1,
          createdAt,
        },
      ],
    }
  }
  if (rec.variant === 'after' || rec.invalid) {
    // 검토 후보 0건(INVALID Run도 같다. 계약 §14.2)
    return { runId: rec.runId, analysisStatus: 'COMPLETED', items: [] }
  }
  const [first] = buildSteps(rec, 1)
  const createdAt = iso(timing.finishedAtMs + ISSUE_DELAY_MS)
  return {
    runId: rec.runId,
    analysisStatus: 'COMPLETED',
    items: [
      {
        schemaVersion: SCHEMA_VERSION,
        issueId: `issue_${rec.runId}_1`,
        runId: rec.runId,
        issueType: 'CHOICE_AMBIGUITY',
        stepId: 1,
        relatedStepIds: [1],
        pagePath: PAGES.home.path,
        pageKey: 'home',
        pageSignature: 'sig_home',
        title: '홈 화면에서 선택이 갈림',
        description: '홈 화면의 후보 확률이 한쪽으로 모이지 않았습니다.',
        evidence: {
          normalizedEntropy: first.decision.normalizedEntropy ?? 0,
          top2Margin: first.decision.top2Margin ?? 0,
        },
        reviewPriority: 'PRIORITY_REVIEW',
        occurrenceCount: 1,
        createdAt,
      },
      {
        schemaVersion: SCHEMA_VERSION,
        issueId: `issue_${rec.runId}_2`,
        runId: rec.runId,
        issueType: 'EXTRA_STEPS',
        stepId: 2,
        relatedStepIds: [2],
        pagePath: PAGES.info.path,
        pageKey: 'info',
        pageSignature: 'sig_info',
        title: '목표까지 추가 이동이 필요함',
        description: '기준 경로보다 한 단계를 더 거쳤습니다.',
        evidence: { extraSteps: 1 },
        reviewPriority: 'GENERAL_REVIEW',
        occurrenceCount: 1,
        createdAt,
      },
    ],
  }
}
