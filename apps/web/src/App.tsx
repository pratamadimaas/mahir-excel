import { Component, lazy, type ReactNode } from 'react';
import { Outlet, Route, Routes } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider } from './app/AuthContext';
import { I18nProvider } from './i18n/I18n';
import { ProgressProvider } from './app/ProgressContext';
import { Layout } from './components/layout/Layout';
import { AcademyPage } from './features/academy/AcademyPage';
import { LessonPage } from './features/academy/LessonPage';
import { ForgotPasswordPage, LoginPage, ProfilePage, RegisterPage } from './features/auth/AuthPages';
import { HomePage } from './features/home/HomePage';
import { ChallengePage, ExerciseCatalogPage, PlaygroundPage } from './features/playground/PlaygroundPages';
import { PlacementPage } from './features/learning/PlacementPage';
import { PremiumPage } from './features/premium/PremiumPage';
import { ProgramPage } from './features/program/ProgramPage';
import { SprintPage } from './features/sprint/SprintPage';
import { ProgressPage } from './features/progress/ProgressPage';
import { CertificateVerifyPage, SharedProgressPage } from './features/progress/Sharing';
import { ShortcutsPage } from './features/shortcuts/ShortcutsPage';
import { AboutPage, NotFoundPage, PrivacyPage, TermsPage } from './features/StaticPages';
import { WorksheetDetailPage, WorksheetsPage } from './features/worksheets/WorksheetPages';
import { TemplatePage } from './features/templates/TemplatePage';
import { ReportPage } from './features/progress/ReportPage';
import { WizardPage } from './features/wizard/WizardPage';
import { PathDetailPage, PathsPage } from './features/paths/PathPages';

// Area admin jarang dipakai: dimuat terpisah agar bundel pengunjung tetap kecil.
const AdminLayout = lazy(() => import('./features/admin/AdminPages').then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./features/admin/AdminUsage').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('./features/admin/AdminUsage').then((m) => ({ default: m.AdminUsers })));
const AdminPremium = lazy(() => import('./features/admin/AdminPremium').then((m) => ({ default: m.AdminPremium })));
const AdminGrowth = lazy(() => import('./features/admin/AdminGrowth').then((m) => ({ default: m.AdminGrowth })));
const AdminReports = lazy(() => import('./features/admin/AdminReports').then((m) => ({ default: m.AdminReports })));
const AdminSprint = lazy(() => import('./features/sprint/AdminSprint').then((m) => ({ default: m.AdminSprint })));
const AdminResourcePage = lazy(() => import('./features/admin/AdminPages').then((m) => ({ default: m.AdminResourcePage })));

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="xl-page xl-page-narrow py-5" role="alert">
        <h1>Terjadi kesalahan</h1>
        <p className="xl-muted">Halaman gagal ditampilkan. Muat ulang halaman; progres belajarmu aman.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
}

function RequireAuthOutlet() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route element={<RequireAuthOutlet />}>
          <Route path="belajar" element={<AcademyPage />} />
          <Route path="latihan" element={<ExerciseCatalogPage />} />
          <Route path="latihan/:slug" element={<PlaygroundPage />} />
          <Route path="shortcut" element={<ShortcutsPage />} />
          <Route path="worksheet" element={<WorksheetsPage />} />
          <Route path="worksheet/:slug" element={<WorksheetDetailPage />} />
          <Route path="tantangan" element={<ChallengePage />} />
          <Route path="kemajuan" element={<ProgressPage />} />
          <Route path="laporan" element={<ReportPage />} />
          <Route path="wizard" element={<WizardPage />} />
        </Route>
        {/* Pelajaran contoh terbuka tanpa login; server menolak (401) pelajaran lain dan halaman menampilkan ajakan masuk. */}
        <Route path="belajar/:slug" element={<LessonPage />} />
        <Route path="tes-penempatan" element={<PlacementPage />} />
        <Route path="jalur" element={<PathsPage />} />
        <Route path="jalur/:slug" element={<PathDetailPage />} />
        <Route path="template" element={<TemplatePage />} />
        <Route path="premium" element={<PremiumPage />} />
        <Route path="program" element={<ProgramPage />} />
        <Route path="sprint" element={<SprintPage />} />
        <Route path="bagikan/:token" element={<SharedProgressPage />} />
        <Route path="sertifikat/:code" element={<CertificateVerifyPage />} />
        <Route path="masuk" element={<LoginPage />} />
        <Route path="daftar" element={<RegisterPage />} />
        <Route path="lupa-sandi" element={<ForgotPasswordPage />} />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="tentang" element={<AboutPage />} />
        <Route path="privasi" element={<PrivacyPage />} />
        <Route path="syarat" element={<TermsPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="pengguna" element={<AdminUsers />} />
          <Route path="sprint" element={<AdminSprint />} />
          <Route path="premium" element={<AdminPremium />} />
          <Route path="pertumbuhan" element={<AdminGrowth />} />
          <Route path="laporan" element={<AdminReports />} />
          <Route path=":resource" element={<AdminResourcePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <ProgressProvider>{children}</ProgressProvider>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
