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
  evidence: Record<string, number | string>
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
