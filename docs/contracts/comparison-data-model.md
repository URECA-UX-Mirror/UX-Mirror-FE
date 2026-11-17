# 비교 데이터 모델

프론트가 소비하는 비교 응답 타입이다. 공통 enum과 Run·Step 타입은 [데이터 모델](data-model.md)을 따른다.

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
  referencePathDeviationCount: number | null;
  detourMoveCount?: number | null;           // OI-10
  path: PathVisit[];
  detectedIssueTypes: IssueType[];
}
```

- `conditionsMatched = false`이면 모든 화면이 비교 불가이고 모든 `delta*`가 `null`이다. 한쪽 값이 `null`이면 해당 `delta`도 `null`이다. 비교 불가 값을 0으로 표현하지 않는다. `계약 §15.5`, `§15.7`
- `conditionChecks`의 `code` 목록은 `계약 §15.2`다. 프론트는 코드 목록을 하드코딩해 판정하지 않고 서버가 준 항목을 순서대로 표시한다.
- 비교 대상 Run은 서버가 고른다(`VALID`인 최종 Run). 프론트는 Run을 직접 고르지 않는다. `계약 §15.1`
