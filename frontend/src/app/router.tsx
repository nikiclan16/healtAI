import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InvestigatorPage } from '@/features/investigator/InvestigatorPage'
import { ResultsPage } from '@/features/results/ResultsPage'
import { ScreeningPage } from '@/features/screening/ScreeningPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            element: <RequireRole role="evaluador" />,
            children: [{ path: 'evaluacion/nueva', element: <ScreeningPage /> }],
          },
          { path: 'evaluacion/:id', element: <ResultsPage /> },
          {
            element: <RequireRole role="investigador" />,
            children: [{ path: 'investigador', element: <InvestigatorPage /> }],
          },
        ],
      },
    ],
  },
])
