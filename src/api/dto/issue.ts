import type {
  AnalysisStatus,
  IssueType,
  ReviewPriority,
} from './common.ts'

/** 계약 §14 */
export interface IssueDto {
  schemaVersion: string
  issueId: string
  runId: string
  issueType: IssueType
  stepId: number | null
  relatedStepIds: number[]
  pagePath: string | null
  pageKey: string | null
  pageSignature: string | null
  title: string
  description: string
  /** `issueType`별 키가 다르고 값이 목록일 수 있다(예: `visitCauses`). 화면에서 타입을 확인한 뒤 표시한다 */
  evidence: Record<string, unknown>
  reviewPriority: ReviewPriority
  occurrenceCount: number
  createdAt: string
}

/** GET /api/runs/{runId}/issues 응답 (계약 §17.5) */
export interface IssueListDto {
  runId: string
  analysisStatus: AnalysisStatus
  items: IssueDto[]
}
