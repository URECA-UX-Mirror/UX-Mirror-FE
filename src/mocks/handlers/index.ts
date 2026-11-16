import { comparisonsHandlers } from './comparisons.ts'
import { presetsHandlers } from './presets.ts'
import { runsHandlers } from './runs.ts'

export const handlers = [
  ...presetsHandlers,
  ...runsHandlers,
  ...comparisonsHandlers,
]
