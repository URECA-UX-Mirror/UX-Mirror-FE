import { BrowserRouter, Route, Routes } from 'react-router'
import { ComparisonPage } from './features/comparison/ComparisonPage.tsx'
import { ImprovementPage } from './features/improvement/ImprovementPage.tsx'
import { ImprovementListPage } from './features/improvement/ImprovementListPage.tsx'
import { OptimizationPage } from './features/optimization/OptimizationPage.tsx'
import { OptimizationStartPage } from './features/optimization/OptimizationStartPage.tsx'
import { NewAnalysisPage } from './features/new-analysis/NewAnalysisPage.tsx'
import { ReplayPage } from './features/replay/ReplayPage.tsx'
import { RunPage } from './features/run-result/RunPage.tsx'
import { ScenarioPage } from './features/scenario/ScenarioPage.tsx'
import { Layout } from './shared/Layout.tsx'

// 경로는 프론트가 정한다(계약서 대상 아님). 화면 이슈는 각자의 features/ 폴더만 고친다.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<NewAnalysisPage />} />
          <Route path="/runs/:runId" element={<RunPage />} />
          <Route path="/runs/:runId/result" element={<RunPage />} />
          <Route path="/scenario" element={<ScenarioPage />} />
          <Route path="/optimizations" element={<OptimizationStartPage />} />
          <Route
            path="/optimizations/:optimizationId"
            element={<OptimizationPage />}
          />
          <Route path="/improvements" element={<ImprovementListPage />} />
          <Route
            path="/improvements/:improvementId"
            element={<ImprovementPage />}
          />
          <Route path="/replay" element={<ReplayPage />} />
          <Route
            path="/comparisons/:experimentKey"
            element={<ComparisonPage />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
