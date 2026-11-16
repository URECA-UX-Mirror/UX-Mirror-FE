import type { IssueListDto } from '../api/dto/index.ts'
import type { IssueList } from '../domain/types.ts'

/** 서버 순서를 그대로 유지한다. 다시 정렬하지 않는다. */
export function toIssueList(dto: IssueListDto): IssueList {
  return {
    runId: dto.runId,
    analysisStatus: dto.analysisStatus,
    items: dto.items.map((issue) => ({
      issueId: issue.issueId,
      issueType: issue.issueType,
      stepId: issue.stepId,
      relatedStepIds: issue.relatedStepIds,
      pagePath: issue.pagePath,
      pageKey: issue.pageKey,
      title: issue.title,
      description: issue.description,
      evidence: issue.evidence,
      reviewPriority: issue.reviewPriority,
      occurrenceCount: issue.occurrenceCount,
    })),
  }
}
