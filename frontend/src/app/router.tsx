import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { AdminLayout, RequireAdmin } from '@/features/admin/AdminLayout'
import { AdminLoginPage } from '@/features/admin/AdminLoginPage'
import { AdminPage } from '@/features/admin/AdminPage'
import { AdminPasswordPage } from '@/features/admin/AdminPasswordPage'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth, RequireRole } from '@/features/auth/guards'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { IntegrationPage } from '@/features/integration/IntegrationPage'
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
          { path: 'cambiar-password', element: <ChangePasswordPage /> },
          { path: 'integracion', element: <IntegrationPage /> },
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
  // Área de administración: URL propia, sesión propia.
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { path: 'login', element: <AdminLoginPage /> },
      {
        element: <RequireAdmin />,
        children: [
          { index: true, element: <AdminPage /> },
          { path: 'password', element: <AdminPasswordPage /> },
        ],
      },
    ],
  },
])
