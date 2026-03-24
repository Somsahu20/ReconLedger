import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PointerEffects } from './components/effects/PointerEffects'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { AppLayout } from './layout/AppLayout'
import { ProtectedRoute } from './layout/ProtectedRoute'
import { PublicOnlyRoute } from './layout/PublicOnlyRoute'

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const UploadPage = lazy(() => import('./pages/UploadPage').then((module) => ({ default: module.UploadPage })))
const InvoicesPage = lazy(() => import('./pages/InvoicesPage').then((module) => ({ default: module.InvoicesPage })))
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage').then((module) => ({ default: module.InvoiceDetailPage })))
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((module) => ({ default: module.ReviewPage })))
const QueryPage = lazy(() => import('./pages/QueryPage').then((module) => ({ default: module.QueryPage })))
const ReconciliationPage = lazy(() => import('./pages/ReconciliationPage').then((module) => ({ default: module.ReconciliationPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))

function RouteLoadingFallback() {
  return (
    <div className="mx-auto my-12 h-24 w-full max-w-7xl animate-pulse rounded-2xl border border-(--line) bg-white/80" />
  )
}

function App() {
  const { user } = useAuth()
  useTheme(user?.id)

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <PointerEffects />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:invoiceNumber" element={<InvoiceDetailPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/query" element={<QueryPage />} />
            <Route path="/reconciliation" element={<ReconciliationPage />} />
            <Route path="/reconciliation/:sessionId" element={<ReconciliationPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
