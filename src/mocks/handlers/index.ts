import { comparisonsHandlers } from './comparisons.ts'
import { improvementsHandlers } from './improvements.ts'
import { optimizationsHandlers } from './optimizations.ts'
import { presetsHandlers } from './presets.ts'
import { runsHandlers } from './runs.ts'
import { sitesHandlers } from './sites.ts'

export const handlers = [
  ...presetsHandlers,
  ...sitesHandlers,
  ...runsHandlers,
  ...comparisonsHandlers,
  ...optimizationsHandlers,
  ...improvementsHandlers,
]
