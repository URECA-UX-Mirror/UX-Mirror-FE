# 데이터 모델과 식별자

프론트가 소비하는 타입이다. 정본은 계약서이며 필드명과 의미는 그대로 따른다. 프론트가 쓰지 않는 필드(저장 전용, 분석 내부 설정)는 생략했다. 서버 응답 타입(DTO)은 `src/api/dto/`, 화면이 쓰는 도메인 모델은 `src/domain/types.ts`, 변환은 `src/adapters/`에 있다. 필드를 추가·변경하기 전에 계약서의 해당 절을 확인한다.

## enum

```ts
type RunStatus = "READY" | "RUNNING" | "SUCCESS" | "BLOCKED" | "MAX_STEPS" | "TIMEOUT" | "ERROR"; // §4.1
type Variant = "before" | "after";                                   // §4.2
type ResultOrigin = "LIVE" | "MOCK" | "SAVED_MEASURED";              // §2.1
type GoalJudgmentMode = "DOM_ONLY" | "MODEL_AND_DOM";               // §4.4
type ActionType = "CLICK" | "GO_BACK";                               // §4.6
type ActionResultCode = "NAVIGATED" | "NO_CHANGE" | "CLICK_FAILED" | "BACK_FAILED"; // §4.8
type IssueType = "CHOICE_AMBIGUITY" | "REFERENCE_PATH_DEVIATION" | "REPEATED_VISIT"
  | "EXTRA_STEPS" | "GOAL_NOT_REACHED";                              // §4.10
type AnalysisStatus = "PENDING" | "COMPLETED" | "FAILED";            // §4.11
type ComparisonStatus = "COMPLETED" | "PARTIAL";                     // §4.12
type ReviewPriority = "PRIORITY_REVIEW" | "GENERAL_REVIEW";          // §4.13
```

`TerminationReason`(§4.14), `ErrorCode`(§4.9), `ActionFailReason`(§4.8.1), 화면 비교 불가 이유(§15.3)는 값이 많아 계약서를 따른다. 프론트는 모르는 값을 오류로 처리하지 않고 코드 문자열을 그대로 보인다.

## Run (`계약 §6`)

```ts
interface Run {
  schemaVersion: string;
  runId: string;
  experimentKey: string;
  variant: Variant;
  resultOrigin: ResultOrigin;
  modelVersion: string | null;
  promptVersion: string;
  temperature: number;
  goalJudgmentMode: GoalJudgmentMode;
  goalId: string | null;             // 직접 입력한 목표면 null (OI-9)
  goal: string;                      // 목표 문구(preset에서 복사 또는 직접 입력)
  personaId: string | null; persona: string;  // 직접 입력한 사용자 유형이면 personaId null (OI-9)
  verification?: { type: string; path: string; text: string; exact: boolean; scope: string } | null; referencePathConfig?: { basis?: 'ALLOWED_PATHS' | 'SITE_MAP'; ... } | null;  // 저장된 성공 조건. 기준 null=없음, 필드·basis 없음=ALLOWED_PATHS (OI-9, OI-10)
  startPath: string;
  viewport: { width: number; height: number };
  limits: { maxSteps: number; modelTimeoutMs: number; runTimeoutMs: number };
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  terminationReason: string | null;  // TerminationReason
  progress: RunProgress;
  summary: RunSummary | null;        // 종료 후에만
  error: ErrorDetail | null;
  validity: "VALID" | "INVALID" | null;   // 종료 전 null
  invalidReason: string | null;
  replacementRunId: string | null;
}
interface RunProgress {
  stepRecordCount: number;           // 저장된 Step 수
  stepCount: number;                 // 탐색 비용 기준 단계 수. stepRecordCount와 다를 수 있다
  maxSteps: number;
  currentPageKey: string | null;
  lastUpdatedAt: string | null;
}
interface RunSummary {
  goalReached: boolean;
  stepCount: number;
  stepRecordCount: number;
  modelCallCount: number;
  clickCount: number;
  successfulNavigationClickCount: number;
  modelBackCount: number;
  systemBackCount: number;
  backCount: number;                 // modelBackCount + systemBackCount
  revisitCount: number;
  referencePathDeviationCount: number | null;  // 허용 경로가 없으면 null
  navigationCost: number;            // successfulNavigationClickCount + backCount
  extraSteps: number | null;         // goalReached=false이거나 허용 경로가 없으면 null
  extraNavigationCost: number | null;
  attemptedExtraSteps: number | null; detourMoveCount?: number | null;  // 우회 이동(사이트 지도 기준). 없으면 null로 읽는다 (OI-10)
  executionTimeMs: number;
  path: PathVisit[];
  detectedIssueTypes: IssueType[];
}
interface PathVisit {
  sequence: number;                  // 0부터
  pageKey: string;
  pageSignature: string;
  path: string;
  enteredBy: ActionType | null;      // 시작 화면은 null
  visitCause: "RUN_START" | "MODEL_NAVIGATION" | "MODEL_BACK" | "SYSTEM_BACK_RECOVERY";
  stepId: number | null;             // 시작 화면·시스템 BACK은 null
}
```

- `stepCount`(탐색 비용 기준)와 `stepRecordCount`(저장된 Step 수)는 다르다. 진행 표시는 `progress.stepCount / progress.maxSteps`를 쓴다.
- `summary`의 `extraSteps` 계열은 목표에 도달하지 못하면 `null`이다. 0으로 바꾸지 않는다. `계약 §6.4`. `referencePathConfig: null`(직접 입력한 목표)이면 `referencePathDeviationCount`, `extraSteps` 계열, Step의 `goalPathProbability`도 `null`이고, 프론트는 명시적 `null`일 때만(없는 필드는 과거 preset Run) "계산 불가 (허용 경로 없음)"으로 표시한다. [OI-9](../operations/open_issue.md#oi-9)
- `Run.limits`의 나머지 필드(`pageChangeTimeoutMs` 등)와 `thresholdConfig`, `analysisVersion`, `comparisonContext`는 프론트가 쓰지 않는다.

## Step (`계약 §12`)

```ts
interface Step {
  schemaVersion: string;
  runId: string;
  stepId: number;                    // Run 안의 1부터 시작하는 순번
  timestamp: string;
  page: PageObservation;
  candidateSet: CandidateSet;
  decision: StepDecision;
  action: ActionRecord;
  statusAfterStep: RunStatus;
  error: ErrorDetail | null;
}
interface PageObservation {          // §7.1
  pageKey: string;
  pageSignature: string;
  path: string;
  title: string;
  viewport: { width: number; height: number };
  screenshotSize: { width: number; height: number };
  scroll: { x: number; y: number };
  screenshotRef: string;             // 원본. 프론트는 API 경로로 요청하고 이 값을 해석하지 않는다
  overlayScreenshotRef: string | null;
  capturedAt: string;
}
interface CandidateSet {             // §8.2
  candidateSetId: string;
  candidateSetChanged: boolean;
  candidateScope: string[];
  actionSetIncludesBack: boolean;
  backOptionId: string | null;       // GO_BACK 선택지 ID. 후보 객체가 아니다
  candidates: StepCandidate[];       // GO_BACK 제외, 전달 순서
}
interface StepCandidate {            // §8.1. domIndex는 프론트에 전달되지 않는다
  optionId: string;                  // 화면마다 option_01부터
  label: string;                     // 화면에 보이는 글자
  region: string;                    // "상단 메뉴" | "본문" | "사이드 메뉴" | "경로 표시" | "하단"
  context: string | null;
  href: string;                      // 목적지 경로(예: /shop/orders). v1.3.4부터 프론트에 전달
  bbox: { x: number; y: number; width: number; height: number };   // 항상 존재
  semanticKey: string;               // 버전 간 같은 의미의 후보 대응
  actionType: "CLICK";
  probability: number;
  selected: boolean;
}
interface StepDecision {             // §12.3. 지표는 평평한 필드다
  selectedOptionId: string;
  selectedActionType: ActionType;
  resultOrigin: ResultOrigin;
  goalJudgmentMode: GoalJudgmentMode;
  modelGoalReached: boolean | null;
  modelGoalYesProb: number | null;
  verifiedGoalReached: boolean;
  goalJudgmentMismatch: boolean;
  normalizedEntropy: number | null;
  clickOnlyNormalizedEntropy: number | null;
  goBackProbability: number | null;
  top2Margin: number | null;
  clickOnlyTop2Margin: number | null;
  goalPathProbability: number | null;
  modelLatencyMs: number | null;     // 정수 밀리초
  metricWarnings: { code: string; message: string }[];
}
interface ActionRecord {             // §11.2
  selectedOptionId: string;
  executedOptionId: string | null;
  actionType: ActionType;
  eventOrigin: "MODEL_DECISION" | "SYSTEM_RECOVERY";
  result: ActionResultCode;
  reason: string | null;             // ActionFailReason
  executed: boolean;
  fromPath: string;
  toPath: string | null;
  startedAt: string;
  finishedAt: string;
  error: ErrorDetail | null;
}
```

- **모델의 선택과 실제 행동은 별개다.** `decision.selectedOptionId`는 모델의 선택이고 `action.executedOptionId`는 실제로 실행한 후보다. 실행하지 못했으면 `null`이다. `계약 §11.2`
- GO_BACK은 후보가 아니다. `decision.selectedActionType = "GO_BACK"`이면 `selectedOptionId == candidateSet.backOptionId`이고, 이때 `candidates[].selected`는 모두 `false`다. GO_BACK 확률은 `decision.goBackProbability`다. `계약 §8.1`
- `Step`에는 후보별 확률 맵(`probabilities`)과 `confidence`가 없다. 후보별 확률은 `StepCandidate.probability`이고 합계는 최대 0.02까지 오차를 허용한다. `계약 §12.3`

## Issue (`계약 §14`)

```ts
interface Issue {
  schemaVersion: string;
  issueId: string;
  runId: string;
  issueType: IssueType;
  stepId: number | null;             // 최초 관찰 Step
  relatedStepIds: number[];
  pagePath: string | null;
  pageKey: string | null;
  pageSignature: string | null;
  title: string;
  description: string;
  evidence: Record<string, unknown>;   // issueType별 키(§14.2). 값이 목록일 수 있다(visitCauses)
  reviewPriority: ReviewPriority;
  occurrenceCount: number;
  createdAt: string;
}
```

`evidence`의 키는 종류마다 다르고 값이 목록일 수 있다(`계약 §14.2`). 프론트는 키별 표시 이름 표를 따로 두고 값의 타입을 확인한 뒤 표시하며, 표에 없는 키는 키 이름 그대로 보인다.

## ComparisonResult (`계약 §15`)

```ts
interface ComparisonResult {
  schemaVersion: string;
  experimentKey: string;
  beforeRunId: string;
  afterRunId: string;
  comparisonStatus: ComparisonStatus;
  conditionsMatched: boolean;
  conditionChecks: { code: string; matched: boolean; message: string | null }[];
  layoutMatched: boolean;
  screenComparisons: ScreenComparison[];
  runComparison: { before: RunOutcome; after: RunOutcome };
  beforeResultOrigin: ResultOrigin;
  afterResultOrigin: ResultOrigin;
  resultOrigin: ResultOrigin | null;         // 두 출처가 다르면 null
  createdAt: string;
}
interface ScreenComparison {
  pageKey: string;
  beforeStepId: number | null;
  afterStepId: number | null;
  screenComparable: boolean;
  reason: string | null;                     // 비교 불가 이유 코드 (§15.3)
  candidateSetMatched: boolean;
  actionSetIncludesBack: boolean | null;
  candidateComparisons: CandidateComparison[];
  metrics: ScreenMetricComparison | null;    // 한쪽 미방문이면 null
}
interface CandidateComparison {
  semanticKey: string;
  beforeLabel: string | null;
  afterLabel: string | null;
  beforeProbability: number | null;
  afterProbability: number | null;
  deltaProbability: number | null;           // 비교 불가면 null
  comparable: boolean;
  reason: string | null;
}
interface ScreenMetricComparison {           // §15.7. 지표마다 before/after/delta 세 필드
  beforeNormalizedEntropy: number | null;
  afterNormalizedEntropy: number | null;
  deltaNormalizedEntropy: number | null;
  // 같은 형태: ClickOnlyNormalizedEntropy, Top2Margin, ClickOnlyTop2Margin, GoBackProbability, GoalPathProbability
}
interface RunOutcome {                       // §15.8. Run.summary에서 복사된 값
  goalReached: boolean;
  status: RunStatus;
  terminationReason: string | null;
  stepCount: number;
  successfulNavigationClickCount: number;
  modelBackCount: number;
  systemBackCount: number;
  backCount: number;
  navigationCost: number;
  extraSteps: number | null;
  extraNavigationCost: number | null;
  referencePathDeviationCount: number; detourMoveCount?: number | null;  // OI-10
  path: PathVisit[];
  detectedIssueTypes: IssueType[];
}
```

- `conditionsMatched = false`이면 모든 화면이 비교 불가이고 모든 `delta*`가 `null`이다. 한쪽 값이 `null`이면 해당 `delta`도 `null`이다. 비교 불가 값을 0으로 표현하지 않는다. `계약 §15.5`, `§15.7`
- `conditionChecks`의 `code` 목록은 `계약 §15.2`다. 프론트는 코드 목록을 하드코딩해 판정하지 않고 서버가 준 항목을 순서대로 표시한다.
- 비교 대상 Run은 서버가 고른다(`VALID`인 최종 Run). 프론트는 Run을 직접 고르지 않는다. `계약 §15.1`

## ErrorDetail (`계약 §16.1`)

```ts
interface ErrorDetail {
  code: string;                      // ErrorCode
  message: string;                   // 사용자에게 표시 가능
  retryable: boolean;
  details: Record<string, unknown> | null;   // 표시하지 않는다
  occurredAt: string;
}
```

## 식별자 정책

| 식별자 | 목적 | 고유성 범위 | 생성 주체 | 전달 방식 |
| --- | --- | --- | --- | --- |
| `runId` | 개별 분석 실행 | 전체 | 백엔드 (`계약 §17.2`) | `POST /api/runs` 응답, 경로 파라미터 |
| `experimentKey` | Before/After 비교 쌍 | 전체. 쌍마다 고유 (`§5.1`) | 프론트가 만든다. `[A-Za-z0-9_-]` 1~64자 (`§5.1`) | 요청 본문, 응답, 경로 파라미터 |
| `stepId` | Run 안의 탐색 단계 | 같은 `runId` 안 (1부터 정수) | 백엔드 | `Step`, 스크린샷 경로 |
| `optionId` | 한 화면(Step) 안의 후보 | 같은 Step 안 (`option_01`…) | 백엔드 | `StepCandidate`, `decision` |
| `semanticKey` | 버전 간 같은 의미의 후보 | 같은 사이트·화면 | 백엔드 (형식 `영역>목적지#순번`) | `StepCandidate`, `CandidateComparison` |
| `pageKey` | Before/After 공통 논리 화면 (`home`, `orders`…) | 같은 사이트 | 백엔드 | `PageObservation`, `PathVisit`, `ScreenComparison` |

- 관계: `experimentKey` 1개 → Run(Before·After) 각 1개 → `stepId` 여러 개 → `optionId` 여러 개. `semanticKey`와 `pageKey`는 서로 다른 Run을 이어 준다.
- 프론트는 ID의 구조를 해석하거나 만들어 내지 않는다. 단 `experimentKey`는 요청에 필요하므로 한 곳에서 생성한다.
- `optionId`는 Before/After 매칭에 쓰지 않는다. 항상 `semanticKey`를 쓴다. `계약 §8.1`
- 화면 표시용 이름은 `pageKey`로 만든다(`home` → 메인 홈 등). 이름 표는 프론트 상수다.
