# 데이터 모델과 식별자

[REST API 임시 계약](rest-api.md)의 응답 타입을 TypeScript 인터페이스로 정리한다. 타입 파일은 아직 만들지 않았으며, 표의 "출처"는 `BE 확인`(저장된 백엔드 결과 파일에 같은 필드가 있음) 또는 `임시`다. 시각은 ISO 8601 문자열, 확률은 0~1, 좌표는 CSS 픽셀이다.

## Run

분석 실행 단위. 단계는 [Step](#step), 상태값은 [실행 상태와 폴링](run-lifecycle.md)에 있다.

```ts
type RunStatus = "RUNNING" | "SUCCESS" | "MAX_STEPS" | "BLOCKED" | "TIMEOUT" | "ERROR";
type ResultOrigin = "MOCK" | "LIVE" | "SAVED_MEASURED";

interface Run {
  runId: string;
  experimentKey: string;
  variant: "before" | "after";
  goalId: string;
  personaId: string;
  status: RunStatus;
  currentStep: number;
  maxSteps: number;
  startedAt: string;
  finishedAt: string | null;
  terminationReason: string | null;
  resultOrigin: ResultOrigin;
  summary: RunSummary;
  modelConfig: ModelConfig;
  viewport: { width: number; height: number };
}
interface RunSummary {
  goalReached: boolean | null;   // 실행 중 null
  totalSteps: number;
  clickCount: number;
  goBackCount: number;
  issueCount: number | null;     // 판정 전 null
}
interface ModelConfig {
  modelId: string;
  temperature: number;
  promptVersion: string;
  goalJudgmentMode: "DOM_ONLY" | "MODEL_AND_DOM";
}
```

| 필드 | Nullable | 단위·의미 | 출처 |
| --- | --- | --- | --- |
| `variant` | 아니오 | `before`/`after`. 표시 이름은 프리셋의 `variants.label` | `BE 확인`(결과 파일 `variant`) |
| `currentStep` | 아니오 | 1부터. 진행 중인 단계 번호. 시작 전 0 | `임시` |
| `maxSteps` | 아니오 | 허용 최대 단계 수 | `임시` |
| `terminationReason` | 예 | 종료 사유 문자열. 종료 전 `null`. 값 목록 미정 | `임시` |
| `resultOrigin` | 아니오 | 데이터 출처 | `BE 확인`(`"LIVE"`) |
| `modelConfig.temperature` | 아니오 | 모델 온도(기본 1.52) | `BE 확인` |
| `modelConfig.promptVersion` | 아니오 | 프롬프트 버전(예 `v2`) | `BE 확인` |
| `modelConfig.goalJudgmentMode` | 아니오 | 목표 판정 방식. 현재 `DOM_ONLY` | `BE 확인` |
| `viewport` | 아니오 | 1440×900 CSS 픽셀 | `BE 확인` |

백엔드 결과 파일의 `modelConfig`에는 체크포인트 경로와 장치 정보(`backend`, `device`, `checkpoint`)도 있지만 프론트 계약에는 포함하지 않는다(서버 경로·GPU 정보 비노출).

## Step

한 번의 에이전트 탐색 단계.

```ts
type StepStatus = "DECIDING" | "EXECUTING" | "DONE" | "FAILED";

interface Step {
  runId: string;
  stepId: string;
  stepIndex: number;             // 1부터
  status: StepStatus;
  startedAt: string | null;
  page: { url: string; path: string; title: string };
  candidates: Candidate[];
  decision: Decision | null;
  action: Action | null;
  metrics: StepMetrics | null;
  probabilityByDestination: Record<string, number> | null;
  screenshot: ScreenshotRef | null;
}
interface Decision {
  choice: string;                // 모델이 고른 optionId
  probabilities: Record<string, number>;   // optionId -> 확률, 합계 1
  confidence: number | null;
  timingMs: number | null;       // 모델 응답 시간(ms)
}
interface Action {
  type: "CLICK" | "GO_BACK";
  optionId: string | null;       // GO_BACK은 null일 수 있음
  targetPath: string | null;     // 이동 결과 경로
  selector: string | null;
  result: "PENDING" | "DONE" | "FAILED";
}
interface ScreenshotRef {
  imageUrl: string | null;       // 없으면 rest-api의 기본 경로 사용
  width: number;                 // 이미지 픽셀
  height: number;
  scrollX: number;
  scrollY: number;
}
```

- **모델의 선택과 실제 행동은 별개다.** `decision`은 모델의 확률 분포와 선택이고 `action`은 Playwright가 실제로 수행한 결과다. `decision`이 있어도 `action.result`가 `FAILED`일 수 있다.
- `confidence`는 모델 응답의 별도 값이다. 결과 파일 예(`b5_20261115_153652.jsonl`)에서 선택 후보의 확률은 0.602, `confidence`는 0.5025로 서로 다르다. 후보별 확률 표시에는 `probabilities`만 쓴다.
- `page.title`은 `BE 확인`(`MORO MARKET`)이며 "메인 홈" 같은 화면 이름은 서버 값에 없다. 프론트는 `page.path`(예 `/shop/home`)에서 이름을 만든다(`임시`, [OI-17](../operations/open_issue.md#oi-17)).
- Step 필드 중 `status`, `startedAt`, `action.*`, `screenshot`은 `임시`다. `page`, `candidates`, `decision`, `metrics`, `probabilityByDestination`의 값은 `BE 확인`이다.

## Candidate

모델이 고를 수 있는 행동 후보. 백엔드 후보 JSON(`candidates_*/before_home.json`)의 구조가 기준이다.

```ts
interface Candidate {
  optionId: string;              // "option_01"
  semanticKey: string;           // "상단 메뉴>/shop/orders#1"
  text: string;                  // 백엔드 필드명은 label
  region: string;                // "상단 메뉴" | "본문"
  href: string | null;           // BE 확인: 후보의 이동 경로
  bbox: Bbox;
  probability: number | null;    // decision이 없으면 null
  selected: boolean;
}
interface Bbox { x: number; y: number; width: number; height: number; }
```

| 필드 | 설명 | 출처 |
| --- | --- | --- |
| `text` | 화면에 보이는 후보 문구. 백엔드 이름은 `label`이라 Adapter가 변환한다 | `BE 확인`(이름 차이) |
| `bbox` | 스크린샷 왼쪽 위 기준 CSS 픽셀(`x`,`y`,`width`,`height`) | `BE 확인` |
| `probability` | `decision.probabilities[optionId]`를 합친 값 | `임시`(합쳐서 내려줄지 [OI-12](../operations/open_issue.md#oi-12)) |
| `selected` | `decision.choice === optionId` | `임시` |
| `semanticKey` | 버전 간 같은 의미의 후보를 대응시키는 키. 모델 입력에는 들어가지 않는다 | `BE 확인` |

- 후보는 첫 화면(스크롤 없는 viewport)에서 보이는 이동 링크만 포함한다(`BE 확인`). 제외된 요소(`excluded`: `SELF_LINK`, `NOT_NAVIGATION`)는 프론트 계약에 포함하지 않는다.
- GO_BACK은 별도 후보(`backOptionId`)로 존재할 수 있으며 `bbox`가 없다(`임시`: `bbox`를 `null`로 허용).

## Issue

규칙 기반 UX 검토 후보. 실제 사용자 결함이 아니다.

```ts
type IssueType = "CHOICE_AMBIGUITY" | "REPEATED_VISIT" | "EXTRA_STEPS";   // 임시, OI-10
type IssuePriority = "HIGH" | "MEDIUM" | "INFO";                          // 높음/보통/참고

interface Issue {
  issueId: string;
  type: IssueType;
  title: string;
  stepIds: string[];             // 발생 단계(전체 세션이면 여러 개)
  priority: IssuePriority;
  rule: string;                  // 예 "P0 Rule 1"
  evidence: IssueEvidence;
}
interface IssueEvidence {
  summary: string[];             // 판정 근거 문장
  metrics: Record<string, number>;   // 예 clickOnlyNormalizedEntropy: 0.74
}
```

디자인 시안이 단계 여러 개(`Step 01 / 03`)를 가리켜 `stepId` 하나가 아닌 `stepIds` 배열로 정의했다. 우선순위 기준과 `type` 목록은 정윤희 담당 영역이며 [OI-10](../operations/open_issue.md#oi-10)에서 확정한다.

## Comparison

```ts
interface Comparison {
  experimentKey: string;
  beforeRunId: string;
  afterRunId: string;
  conditionsMatched: boolean;
  conditions: { key: string; label: string; matched: boolean }[];  // 사이트·목표·페르소나·모델·단일 변인
  mismatchReasons: string[];     // conditionsMatched=false일 때만
  metrics: ComparisonMetric[] | null;
  matchedCandidates: MatchedCandidate[];
  pathComparison: { before: PathNode[]; after: PathNode[] };
  issueComparison: IssueDelta[];
}
interface ComparisonMetric {
  key: string;                   // "clickOnlyNormalizedEntropy" | "top2Margin" | "clickCount" | "goBackCount" | "totalSteps" | "issueCount" | "pathCost" | "goalPathProbability"
  label: string;
  unit: "ratio" | "probability" | "count" | "score";
  before: number | null;
  after: number | null;
  delta: number | null;          // after - before, 서버가 계산
  verdict: string | null;        // 서버가 판정(예 "개선")
}
interface MatchedCandidate {
  semanticKey: string;           // 버전 간 대응 키
  beforeOptionId: string | null;
  afterOptionId: string | null;
  beforeText: string | null;
  afterText: string | null;
  beforeProbability: number | null;
  afterProbability: number | null;
  beforeBbox: Bbox | null;
  afterBbox: Bbox | null;
}
interface PathNode { stepId: string; pathLabel: string; path: string; action: "CLICK" | "GO_BACK" | null; goalReached: boolean; }
interface IssueDelta { type: IssueType; before: boolean; after: boolean; verdict: "RESOLVED" | "NEW" | "PERSISTS" | "NONE"; }
```

- 지표 키는 `BE 확인`(`clickOnlyNormalizedEntropy`, `top2Margin`)과 디자인 시안에서 필요한 `pathCost`, `goalPathProbability`가 섞여 있다. 후자는 백엔드 정의가 없는 `임시`다. [OI-11](../operations/open_issue.md#oi-11)
- 이 필드는 프론트 요구사항이며 백엔드 계약이 다르면 Adapter로 흡수하고 차이를 [미결정 항목](../operations/open_issue.md)에 기록한다.

## 식별자 정책

| 식별자 | 목적 | 고유성 범위 | 생성 주체 | 전달 방식 | 저장 |
| --- | --- | --- | --- | --- | --- |
| `runId` | 개별 분석 실행 | 전체 | 백엔드(`미정`) | `POST /api/runs` 응답, 경로 파라미터 | 백엔드 저장. 프론트는 URL과 `localStorage`(임시) |
| `experimentKey` | 비교 대상 Run을 묶는 키 | 전체 | `미정`(서버 발급 가정) | 응답·요청 본문, 경로 파라미터 | 백엔드 저장 |
| `stepId` | Run 내부 탐색 단계 | 같은 `runId` 안 | 백엔드 `미정` | `Step`, 스크린샷 경로 | 백엔드 저장 |
| `optionId` | Step 내부 후보 | 같은 Step 안(`option_01`…) | 백엔드(`BE 확인`) | `Candidate`, `Decision` | 백엔드 저장 |
| `semanticKey` | 버전 간 같은 의미의 후보 | 같은 사이트·페이지 | 백엔드(`BE 확인`, 형식 `영역>경로#순번`) | `Candidate`, `MatchedCandidate` | 백엔드 저장 |

- 관계: `experimentKey` 1개 → Run N개(P0는 `before`·`after` 각 1개) → `stepId` N개 → `optionId` N개. `semanticKey`는 서로 다른 Run의 `optionId`를 이어 준다.
- `optionId`는 Step마다 1부터 다시 매겨지므로 다른 Step·Run의 `optionId`를 같은 후보로 보지 않는다. 버전 간 대응은 `semanticKey`만 쓴다.
- 프론트는 식별자를 만들거나 해석하지 않고 불투명한 문자열로 취급한다. 화면의 `#RUN-2025-084` 같은 표기는 `runId` 그대로 쓴다. 형식이 확정되면 표시 규칙만 조정한다. [OI-1](../operations/open_issue.md#oi-1), [OI-2](../operations/open_issue.md#oi-2)
