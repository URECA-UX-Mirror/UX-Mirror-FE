import { useId, useState } from 'react'
import { GOAL_SCREENS, inputProblems, PERSONA_CHOICES, screenOf, type CustomerInput } from './customerInput.ts'
import { MAX_SENTENCE } from './inputRules.ts'

/**
 * "[어떤 고객]이 [이 일]을 하려고 할 때, [이 화면]까지 잘 찾아오나요?" 세 칸.
 * `showErrors`가 true면 칸 아래에 안내를 보인다 (시작을 눌렀을 때).
 */
export function CustomerInputs({ value, onChange, showErrors, disabled }: {
  value: CustomerInput
  onChange: (next: CustomerInput) => void
  showErrors: boolean
  disabled?: boolean
}) {
  const id = useId()
  const problems = showErrors ? inputProblems(value) : null
  // 직접 쓰기를 누른 뒤에는 칩과 같은 글자를 적어도 직접 쓰기 칸을 유지한다
  const [customMode, setCustomMode] = useState(() => !PERSONA_CHOICES.includes(value.persona as (typeof PERSONA_CHOICES)[number]))
  const custom = customMode
  return (
    <div className="customer-inputs">
      <p className="customer-question">
        <strong>{value.persona.trim() || '어떤'}</strong> 고객이{' '}
        <strong>{value.goal.trim() || '무언가를 하려고 할'}</strong> 때,{' '}
        <strong>{screenOf(value.pageKey).label}</strong> 화면까지 잘 찾아올까요?
      </p>

      <fieldset className="field" disabled={disabled}>
        <legend>어떤 고객인가요?</legend>
        <div className="chip-row">
          {PERSONA_CHOICES.map((choice) => (
            <button key={choice} type="button" className="chip" aria-pressed={!custom && value.persona === choice} onClick={() => { setCustomMode(false); onChange({ ...value, persona: choice }) }}>
              {choice}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={custom} onClick={() => { if (!custom) { setCustomMode(true); onChange({ ...value, persona: '' }) } }}>
            직접 쓰기
          </button>
        </div>
        {custom ? (
          <input aria-label="고객 유형 직접 쓰기" value={value.persona} maxLength={MAX_SENTENCE} placeholder="예: 스마트폰이 익숙하지 않은 60대 고객" onChange={(e) => onChange({ ...value, persona: e.target.value })} />
        ) : null}
        {problems?.persona ? <p role="alert" className="field-error">{problems.persona}</p> : null}
      </fieldset>

      <label className="field" htmlFor={`${id}-goal`}>
        <span className="field-head">고객이 하려는 일</span>
        <input id={`${id}-goal`} value={value.goal} maxLength={MAX_SENTENCE} disabled={disabled} placeholder="예: 지난주에 산 운동화가 안 맞아서 돌려보내고 싶어요" onChange={(e) => onChange({ ...value, goal: e.target.value })} />
        {problems?.goal ? <span role="alert" className="field-error">{problems.goal}</span> : null}
      </label>

      <label className="field" htmlFor={`${id}-page`}>
        <span className="field-head">도착하면 성공인 화면</span>
        <select id={`${id}-page`} value={value.pageKey} disabled={disabled} onChange={(e) => onChange({ ...value, pageKey: e.target.value })}>
          {GOAL_SCREENS.map((s) => <option key={s.pageKey} value={s.pageKey}>{s.label}</option>)}
        </select>
      </label>
    </div>
  )
}
