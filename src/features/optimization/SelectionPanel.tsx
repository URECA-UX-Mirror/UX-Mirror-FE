import type { Optimization } from '../../domain/types.ts'
import { SectionTitle } from '../../shared/SectionTitle.tsx'
import { CheckCircleIcon } from '../../shared/icons.tsx'
import { VerifyControl } from './VerifyControl.tsx'
import {
  recommendationLabel,
  reasonLabel,
  selectionStatusLabel,
} from './labels.ts'

function ReasonCode({ code }: { code: string }) {
  const label = reasonLabel(code)
  return (
    <>
      {label ? `${label} ` : null}
      <code>{code}</code>
    </>
  )
}

/** 후보 이름. 후보 풀에 없는 ID는 ID만 보인다 */
function nameOf(optimization: Optimization, candidateId: string | null): string {
  if (candidateId === null) return '없음'
  const found = optimization.candidates.find((c) => c.candidateId === candidateId)
  return found ? `${candidateId} ${found.label}` : candidateId
}

/**
 * 선정 결과. 추천 후보와 검증 후보는 다를 수 있어(검증 후보는 전체 적격 후보 중 1위) 따로 보인다.
 * 평가가 끝난(`EVALUATED`) 상태에서는 "검증 시작"으로 검증을 시작한다.
 */
export function SelectionPanel({
  optimization,
  onVerifySettled,
}: {
  optimization: Optimization
  onVerifySettled: () => void
}) {
  const selection = optimization.selection
  if (!selection) return null
  return (
    <section className="card" aria-label="선정 결과">
      <SectionTitle icon={<CheckCircleIcon />} title="선정 결과" />
      <dl className="meta-row selection-meta">
        <div>
          <dt>선정 상태</dt>
          <dd>{selection.status ? selectionStatusLabel(selection.status) : '-'}</dd>
        </div>
        <div>
          <dt>추천 여부</dt>
          <dd>
            {optimization.recommendationStatus
              ? recommendationLabel(optimization.recommendationStatus)
              : '-'}
          </dd>
        </div>
        <div>
          <dt>추천 후보</dt>
          <dd>{nameOf(optimization, optimization.recommendedCandidateId)}</dd>
        </div>
        <div>
          <dt>검증 후보</dt>
          <dd>{nameOf(optimization, optimization.verificationCandidateId)}</dd>
        </div>
        <div>
          <dt>선정 사유</dt>
          <dd>{selection.reasonCode ? <ReasonCode code={selection.reasonCode} /> : '-'}</dd>
        </div>
      </dl>
      {optimization.recommendedCandidateId === null ? (
        // 적격 후보가 없어(NOT_SELECTABLE) 검증 후보도 없으면 선정 상태 줄이 이유를 말하므로 따로 안내하지 않는다
        optimization.verificationCandidateId !== null ? (
          <p className="muted">
            추천 기준(+5%p)을 넘은 후보가 없어 추천 후보가 없습니다. 검증 후보는 전체 적격 후보 중 1위입니다.
          </p>
        ) : null
      ) : optimization.recommendedCandidateId !== optimization.verificationCandidateId ? (
        <p className="muted">
          검증 후보는 전체 적격 후보 중 1위이고 추천 후보와 다를 수 있습니다.
        </p>
      ) : null}
      {selection.excludedCandidates.length > 0 ? (
        <>
          <h3>제외된 후보</h3>
          <ul className="reason-list" aria-label="제외된 후보">
            {selection.excludedCandidates.map((item) => (
              <li key={item.candidateId}>
                <strong>{nameOf(optimization, item.candidateId)}</strong>
                {item.reasonCodes.length > 0 ? (
                  <ul>
                    {item.reasonCodes.map((code) => (
                      <li key={code}>
                        <ReasonCode code={code} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {optimization.status === 'EVALUATED' ? (
        <VerifyControl
          optimizationId={optimization.optimizationId}
          candidateName={
            optimization.verificationCandidateId === null
              ? null
              : nameOf(optimization, optimization.verificationCandidateId)
          }
          onSettled={onVerifySettled}
        />
      ) : null}
    </section>
  )
}
