import type {
  IssueDto,
  IssueListDto,
  IssueType,
  PathVisitDto,
  RunDto,
  RunSummaryDto,
  StepDto,
} from '../../api/dto/index.ts'
import type { RunRecord } from '../store.ts'
import { findSite } from './sites.ts'
import {
  GOAL,
  GOAL_VERIFICATION,
  REFERENCE_PATH_CONFIG,
  PAGES,
  PERSONAS,
  SHORTEST_ALLOWED_STEPS,
  VIEWPORT,
  pageSignature,
  stepSpecs,
  type PageKey,
  type ScenarioName,
  type StepSpec,
} from './scenario.ts'
import {
  countDetourMoves,
  goalPageKeyOf,
  movesCloser,
  siteMapConfig,
  siteMapConfigForSite,
} from './siteMap.ts'

/** 생성 후 첫 Step이 시작되기까지(READY 구간) */
export const START_MS = 1000
/** Step 하나가 저장되기까지 걸리는 시간 */
export const STEP_MS = 2000
/** 종료 후 `/issues`가 `PENDING`으로 남아 있는 시간 */
export const ISSUE_DELAY_MS = 3000

const SCHEMA_VERSION = '1.3.5'
const ENTROPY_THRESHOLD = 0.9
const iso = (ms: number) => new Date(ms).toISOString()
const round = (value: number) => Math.round(value * 10000) / 10000

const isSiteMap = (rec: RunRecord): boolean => rec.reference === 'site-map'

/** 경로 지표 기준이 없는 Run인지. 사이트 지도 기준은 직접 입력한 목표에도 적용된다 */
const hasNoReference = (rec: RunRecord): boolean =>
  rec.reference === 'none' || (rec.goalId === null && !isSiteMap(rec))

// ---- 시나리오 Run(임시, OI-11): 경로를 등록 사이트의 화면으로 만든다 ----
// Step은 쇼핑몰 `PageKey` 두 개(`home` = 사이트 시작 화면, `mypage` = 성공 조건의 도착 화면)로 계산하고, 출력 단계에서만
// 사이트 화면으로 바꾼다. 이미지는 `spec.pageKey`로 고르므로 기존 mock 이미지를 재사용한다.

interface PageView {
  pageKey: string
  path: string
  title: string
}

function pageView(rec: RunRecord, key: PageKey): PageView {
  const site = rec.siteId ? findSite(rec.siteId) : undefined
  if (!site) return { pageKey: key, path: PAGES[key].path, title: PAGES[key].title }
  const page = key === 'home'
    ? site.pages.find((item) => item.pageKey === site.startPage)
    : site.pages.find((item) => item.path === rec.verification?.path)
  if (!page) throw new Error(`mock 사이트 화면을 찾을 수 없습니다: ${rec.siteId} ${key}`)
  return { pageKey: page.pageKey, path: page.path, title: page.label }
}

/** 시나리오 Run의 Step: 시작 화면에서 도착 화면으로 가는 클릭 1번. 후보는 도착 화면 하나다. */
function siteSpecs(rec: RunRecord): StepSpec[] {
  const target = pageView(rec, 'mypage')
  return [{
    pageKey: 'home',
    selected: 'option_01',
    choices: {
      candidates: [{
        optionId: 'option_01',
        label: target.title,
        region: '상단 메뉴',
        context: null,
        href: target.path,
        bbox: { x: 470, y: 26, width: 84, height: 28 },
        semanticKey: `상단 메뉴>${target.path}#1`,
        probability: 1,
        onGoalPath: true,
        leadsTo: 'mypage',
      }],
      backOptionId: null,
      goBackProbability: null,
    },
  }]
}

/** 이 Run의 Step 목록 */
export const specsOf = (rec: RunRecord): StepSpec[] =>
  rec.siteId ? siteSpecs(rec) : stepSpecs(scenarioOf(rec))

/** 사이트 지도 기준 Run의 지도 설정. 쇼핑몰은 목표 화면별 거리표, 시나리오 사이트는 그 사이트의 지도 */
function siteMapOf(rec: RunRecord) {
  const site = rec.siteId ? findSite(rec.siteId) : undefined
  if (site) {
    const goal = site.pages.find((page) => page.path === rec.verification?.path)
    return (goal && siteMapConfigForSite(site, goal.pageKey)) ?? null
  }
  return siteMapConfig(goalPageKeyOf(rec.verification?.path))
}

/**
 * Step 계산에 쓰는 거리표. 시나리오 Run은 Step이 쇼핑몰 `PageKey`(`home`·`mypage`)로 계산되므로
 * 사이트 지도의 거리를 그 두 키로 옮긴다.
 */
function stepDistancesOf(rec: RunRecord): Record<string, number | null> {
  const config = siteMapOf(rec)
  if (!config) return {}
  if (!rec.siteId) return config.distances
  return { home: config.distances[config.startPageKey] ?? null, mypage: config.distances[config.goalPageKey] ?? null }
}

/** 목표까지의 최단 클릭 수. 사이트 지도 기준이면 지도의 값, 아니면 허용 경로의 값 */
const shortestStepsOf = (rec: RunRecord): number =>
  isSiteMap(rec) ? (siteMapOf(rec)?.shortestSteps ?? 0) : SHORTEST_ALLOWED_STEPS

function referencePathConfig(rec: RunRecord): RunDto['referencePathConfig'] {
  if (hasNoReference(rec)) return null
  if (isSiteMap(rec)) return siteMapOf(rec)
  if (rec.reference === 'legacy') return REFERENCE_PATH_CONFIG
  return { basis: 'ALLOWED_PATHS', ...REFERENCE_PATH_CONFIG }
}

export const scenarioOf = (rec: RunRecord): ScenarioName =>
  rec.scenario ?? rec.variant

/** 이 Run에서 실제로 실행되는 Step 수. 시나리오 단계 수와 `maxSteps` 중 작은 값이다. */
export function stepLimit(rec: RunRecord): number {
  return Math.min(
    specsOf(rec).length,
    Math.max(1, rec.maxSteps),
  )
}

/** `maxSteps`에 먼저 도달해 목표 화면에 도착하지 못하고 끝나는 Run인지 */
export function isMaxStepsStopped(rec: RunRecord): boolean {
  return rec.maxSteps < specsOf(rec).length
}

export interface Timing {
  totalSteps: number
  doneSteps: number
  started: boolean
  terminal: boolean
  finishedAtMs: number
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

// ---- 탐색 시뮬레이션 ----

interface Move {
  /** 이 Step에서 이동한 화면 */
  to: PageKey
  back: boolean
}

/** 앞에서부터 `count`개 Step을 실행했을 때의 이동. GO_BACK은 직전 화면으로 돌아간다. */
function simulate(specs: StepSpec[], count: number): Move[] {
  const history: PageKey[] = ['home']
  const moves: Move[] = []
  for (const spec of specs.slice(0, count)) {
    if (spec.selected === 'BACK') {
      history.pop()
      moves.push({ to: history[history.length - 1], back: true })
    } else {
      const target = spec.choices.candidates.find(
        (c) => c.optionId === spec.selected,
      )!.leadsTo
      history.push(target)
      moves.push({ to: target, back: false })
    }
  }
  return moves
}

/** 사이트 지도의 모든 CLICK 목적지를 확인한 뒤 목표 방향의 확률을 합한다. */
export function siteMapGoalProbability(
  distances: Record<string, number | null>,
  pageKey: PageKey,
  candidates: { leadsTo: PageKey; probability: number }[],
): number | null {
  if (!(pageKey in distances) || candidates.some((c) => !(c.leadsTo in distances))) return null
  return round(candidates.filter((c) => movesCloser(distances, pageKey, c.leadsTo))
    .reduce((sum, c) => sum + c.probability, 0))
}

// ---- Step ----

export function buildSteps(rec: RunRecord, count: number): StepDto[] {
  const specs = specsOf(rec).slice(0, stepLimit(rec))
  const moves = simulate(specs, specs.length)
  const stopped = isMaxStepsStopped(rec)
  const steps: StepDto[] = []

  for (let i = 0; i < Math.min(count, specs.length); i += 1) {
    const { pageKey, choices, selected } = specs[i]
    const stepId = i + 1
    const isBack = selected === 'BACK'
    const clickProbabilities = choices.candidates.map((c) => c.probability)
    const all =
      choices.goBackProbability === null
        ? clickProbabilities
        : [...clickProbabilities, choices.goBackProbability]
    const goalPath = choices.candidates.filter((c) => c.onGoalPath)
    const goalPathProbability = hasNoReference(rec)
      ? null
      : isSiteMap(rec)
        ? siteMapGoalProbability(stepDistancesOf(rec), pageKey, choices.candidates)
        : goalPath.length === 0 ? null : round(goalPath.reduce((sum, c) => sum + c.probability, 0))
    const startedMs = rec.createdAtMs + START_MS + i * STEP_MS
    const move = moves[i]
    const view = pageView(rec, pageKey)
    const next = pageView(rec, move.to)
    const selectedOptionId = isBack ? choices.backOptionId! : selected

    steps.push({
      schemaVersion: SCHEMA_VERSION,
      runId: rec.runId,
      stepId,
      timestamp: iso(startedMs + STEP_MS),
      page: {
        pageKey: view.pageKey,
        pageSignature: pageSignature(view.pageKey),
        path: view.path,
        title: view.title,
        viewport: VIEWPORT,
        screenshotSize: VIEWPORT,
        scroll: { x: 0, y: 0 },
        screenshotRef: `mock/${rec.runId}/step_${stepId}.png`,
        overlayScreenshotRef: null,
        capturedAt: iso(startedMs),
      },
      candidateSet: {
        candidateSetId: `cs_${pageKey}_${stepId}`,
        candidateSetChanged: true,
        candidateScope: ['viewport'],
        actionSetIncludesBack: choices.backOptionId !== null,
        backOptionId: choices.backOptionId,
        candidates: choices.candidates.map((c) => ({
          optionId: c.optionId,
          label: c.label,
          region: c.region,
          context: c.context,
          href: c.href,
          bbox: c.bbox,
          semanticKey: c.semanticKey,
          actionType: 'CLICK',
          probability: c.probability,
          selected: !isBack && c.optionId === selected,
        })),
      },
      decision: {
        selectedOptionId,
        selectedActionType: isBack ? 'GO_BACK' : 'CLICK',
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
        selectedOptionId,
        executedOptionId: selectedOptionId,
        actionType: isBack ? 'GO_BACK' : 'CLICK',
        eventOrigin: 'MODEL_DECISION',
        result: 'NAVIGATED',
        reason: null,
        executed: true,
        fromPath: view.path,
        toPath: next.path,
        startedAt: iso(startedMs + 1200),
        finishedAt: iso(startedMs + STEP_MS),
        error: null,
      },
      statusAfterStep:
        i === specs.length - 1 ? (stopped ? 'MAX_STEPS' : 'SUCCESS') : 'RUNNING',
      error: null,
    })
  }
  return steps
}

// ---- Run ----

/** 실제 방문 경로. `stepId`는 그 방문을 만든 Step이다(시작 화면은 null, 계약 §6.4). */
function buildPath(rec: RunRecord): PathVisitDto[] {
  const specs = specsOf(rec).slice(0, stepLimit(rec))
  const moves = simulate(specs, specs.length)
  const start = pageView(rec, 'home')
  const visits: PathVisitDto[] = [
    {
      sequence: 0,
      pageKey: start.pageKey,
      pageSignature: pageSignature(start.pageKey),
      path: start.path,
      enteredBy: null,
      visitCause: 'RUN_START',
      stepId: null,
    },
  ]
  moves.forEach((move, index) => {
    const view = pageView(rec, move.to)
    visits.push({
      sequence: index + 1,
      pageKey: view.pageKey,
      pageSignature: pageSignature(view.pageKey),
      path: view.path,
      enteredBy: move.back ? 'GO_BACK' : 'CLICK',
      visitCause: move.back ? 'MODEL_BACK' : 'MODEL_NAVIGATION',
      stepId: index + 1,
    })
  })
  return visits
}

export function buildSummary(rec: RunRecord): RunSummaryDto {
  const specs = specsOf(rec).slice(0, stepLimit(rec))
  const stopped = isMaxStepsStopped(rec)
  const noReference = hasNoReference(rec)
  const path = buildPath(rec)
  const modelBackCount = specs.filter((s) => s.selected === 'BACK').length
  const clickCount = specs.length - modelBackCount
  const stepCount = specs.length
  const backCount = modelBackCount
  const navigationCost = clickCount + backCount
  const seen = new Set<string>()
  let revisitCount = 0
  for (const visit of path) {
    if (seen.has(visit.pageSignature)) revisitCount += 1
    seen.add(visit.pageSignature)
  }
  const shortest = shortestStepsOf(rec)
  const extraSteps = Math.max(0, clickCount - shortest)
  return {
    goalReached: !stopped,
    stepCount,
    stepRecordCount: specs.length,
    modelCallCount: specs.length,
    clickCount,
    successfulNavigationClickCount: clickCount,
    modelBackCount,
    systemBackCount: 0,
    backCount,
    revisitCount,
    // 이탈 횟수는 허용 경로 기준의 값이다. 사이트 지도 기준에서는 계산하지 않는다
    referencePathDeviationCount: noReference || isSiteMap(rec) ? null : 0,
    navigationCost,
    // 목표에 도달하지 못하거나 허용 경로가 없으면 extraSteps 계열은 null이다(계약 §6.4, UX-Mirror-BE #39)
    extraSteps: stopped || noReference ? null : extraSteps,
    extraNavigationCost: stopped || noReference
      ? null
      : Math.max(0, navigationCost - shortest),
    attemptedExtraSteps: stopped || noReference
      ? null
      : Math.max(0, stepCount - shortest),
    // 우회 이동은 사이트 지도 기준에서만 있다. 지도 기준이 아니면 필드를 주지 않는다(백엔드 미반영 상태)
    ...(isSiteMap(rec)
      ? {
          detourMoveCount: countDetourMoves(
            simulate(specs, specs.length),
            stepDistancesOf(rec),
          ),
        }
      : {}),
    executionTimeMs: stepCount * STEP_MS,
    path,
    detectedIssueTypes: buildIssues(rec, Number.MAX_SAFE_INTEGER).items.map(
      (issue) => issue.issueType,
    ),
  }
}

export function buildRun(rec: RunRecord, nowMs: number): RunDto {
  const timing = getTiming(rec, nowMs)
  const persona =
    PERSONAS.find((p) => p.personaId === rec.personaId) ?? PERSONAS[0]
  const specs = specsOf(rec)
  const stopped = isMaxStepsStopped(rec)
  const status = timing.terminal
    ? stopped
      ? 'MAX_STEPS'
      : 'SUCCESS'
    : timing.started
      ? 'RUNNING'
      : 'READY'
  const moves = simulate(specs, timing.doneSteps)
  const currentPageKey = timing.started
    ? pageView(rec, moves[moves.length - 1]?.to ?? 'home').pageKey
    : null

  return {
    schemaVersion: SCHEMA_VERSION,
    runId: rec.runId,
    experimentKey: rec.experimentKey,
    variant: rec.variant,
    resultOrigin: 'MOCK',
    modelVersion: null,
    promptVersion: 'v2',
    temperature: 0,
    goalJudgmentMode: 'DOM_ONLY',
    goalId: rec.goalId,
    goal: rec.goal ?? GOAL.goal,
    personaId: rec.personaId === null ? null : persona.personaId,
    persona: rec.persona ?? persona.persona,
    verification: rec.verification ?? GOAL_VERIFICATION,
    // 직접 입력한 목표는 허용 경로가 없다 → 경로 기반 지표 null
    referencePathConfig: referencePathConfig(rec),
    startPath: pageView(rec, 'home').path,
    viewport: VIEWPORT,
    limits: {
      maxSteps: rec.maxSteps,
      modelTimeoutMs: 30000,
      runTimeoutMs: 180000,
    },
    status,
    createdAt: iso(rec.createdAtMs),
    startedAt: timing.started ? iso(rec.createdAtMs + START_MS) : null,
    finishedAt: timing.terminal ? iso(timing.finishedAtMs) : null,
    terminationReason: timing.terminal
      ? stopped
        ? 'MAX_STEPS_REACHED'
        : 'GOAL_VERIFIED'
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
    invalidReason: timing.terminal && rec.invalid ? 'BROWSER_CRASH' : null,
    replacementRunId: rec.replacementRunId ?? null,
    // 버전 비교 Run에는 두 필드를 주지 않는다(필드가 없는 응답도 버전 비교 Run으로 읽는다)
    ...(rec.siteId ? { siteId: rec.siteId, mode: 'SCENARIO' } : {}),
  }
}

// ---- Issue (계약 §14.2, 정렬은 §14.4) ----

const ISSUE_ORDER: IssueType[] = [
  'GOAL_NOT_REACHED',
  'REFERENCE_PATH_DEVIATION',
  'REPEATED_VISIT',
  'EXTRA_STEPS',
  'CHOICE_AMBIGUITY',
]

function issueItems(rec: RunRecord, createdAt: string): IssueDto[] {
  if (rec.invalid) return []
  const specs = specsOf(rec).slice(0, stepLimit(rec))
  const start = pageView(rec, 'home')
  const summary = {
    ...buildSummaryCounts(rec),
  }
  const base = {
    schemaVersion: SCHEMA_VERSION,
    runId: rec.runId,
    createdAt,
    occurrenceCount: 1,
  }
  const issues: IssueDto[] = []
  let n = 0
  const id = () => `issue_${rec.runId}_${(n += 1)}`

  if (isMaxStepsStopped(rec)) {
    issues.push({
      ...base,
      issueId: id(),
      issueType: 'GOAL_NOT_REACHED',
      stepId: null,
      relatedStepIds: [],
      pagePath: null,
      pageKey: null,
      pageSignature: null,
      title: '최대 탐색 횟수 안에 목표에 도달하지 못함',
      description: '정해진 횟수 안에 목표 화면에 도착하지 못했습니다.',
      evidence: {
        status: 'MAX_STEPS',
        terminationReason: 'MAX_STEPS_REACHED',
        stepCount: specs.length,
      },
      reviewPriority: 'PRIORITY_REVIEW',
    })
    return issues
  }

  const backIndex = specs.findIndex((s) => s.selected === 'BACK')
  if (backIndex >= 0) {
    issues.push({
      ...base,
      issueId: id(),
      issueType: 'REPEATED_VISIT',
      stepId: backIndex + 1,
      relatedStepIds: [backIndex + 1],
      pagePath: start.path,
      pageKey: start.pageKey,
      pageSignature: pageSignature(start.pageKey),
      title: '이미 방문한 화면으로 되돌아옴',
      description: '모델이 뒤로 가기를 골라 홈 화면에 다시 들어갔습니다.',
      evidence: {
        pageSignature: pageSignature(start.pageKey),
        visitCount: 2,
        visitCauses: ['RUN_START', 'MODEL_BACK'],
      },
      reviewPriority: 'PRIORITY_REVIEW',
    })
  }
  // 허용 경로가 없는 Run(직접 입력한 목표)은 추가 단계를 계산하지 않으므로 EXTRA_STEPS도 만들지 않는다(UX-Mirror-BE #44)
  if (!hasNoReference(rec) && summary.extraSteps > 0) {
    issues.push({
      ...base,
      issueId: id(),
      issueType: 'EXTRA_STEPS',
      stepId: null,
      relatedStepIds: [],
      pagePath: null,
      pageKey: null,
      pageSignature: null,
      title: '목표까지 추가 이동이 필요함',
      description: '허용 최단 경로보다 이동을 더 했습니다.',
      evidence: {
        successfulNavigationClickCount: summary.clickCount,
        shortestAllowedSteps: shortestStepsOf(rec),
        extraSteps: summary.extraSteps,
      },
      reviewPriority: 'GENERAL_REVIEW',
    })
  }
  // 홈 화면(1번째 Step)의 클릭 후보 엔트로피가 임계값 이상이면 선택이 갈린 것으로 본다.
  const [first] = buildSteps(rec, 1)
  const clickEntropy = first.decision.clickOnlyNormalizedEntropy
  if (clickEntropy !== null && clickEntropy >= ENTROPY_THRESHOLD) {
    issues.push({
      ...base,
      issueId: id(),
      issueType: 'CHOICE_AMBIGUITY',
      stepId: 1,
      relatedStepIds: [1],
      pagePath: start.path,
      pageKey: start.pageKey,
      pageSignature: pageSignature(start.pageKey),
      title: '홈 화면에서 선택이 갈림',
      description: '홈 화면의 후보 확률이 한쪽으로 모이지 않았습니다.',
      evidence: {
        clickOnlyNormalizedEntropy: clickEntropy,
        clickOnlyTop2Margin: first.decision.clickOnlyTop2Margin ?? 0,
        candidateCount: first.candidateSet.candidates.length,
        entropyThreshold: ENTROPY_THRESHOLD,
      },
      reviewPriority: 'GENERAL_REVIEW',
    })
  }
  return issues.sort(
    (a, b) =>
      ISSUE_ORDER.indexOf(a.issueType) - ISSUE_ORDER.indexOf(b.issueType),
  )
}

/** buildSummary와 순환하지 않도록 이슈 계산에 필요한 카운터만 계산한다. */
function buildSummaryCounts(rec: RunRecord) {
  const specs = specsOf(rec).slice(0, stepLimit(rec))
  const clickCount = specs.filter((s) => s.selected !== 'BACK').length
  return {
    clickCount,
    extraSteps: Math.max(0, clickCount - shortestStepsOf(rec)),
  }
}

export function buildIssues(rec: RunRecord, nowMs: number): IssueListDto {
  const timing = getTiming(rec, nowMs)
  const ready = timing.terminal && nowMs >= timing.finishedAtMs + ISSUE_DELAY_MS
  if (!ready) {
    return { runId: rec.runId, analysisStatus: 'PENDING', items: [] }
  }
  return {
    runId: rec.runId,
    analysisStatus: 'COMPLETED',
    items: issueItems(rec, iso(timing.finishedAtMs + ISSUE_DELAY_MS)),
  }
}
