import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import RequireCoordinator from './components/RequireCoordinator';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import Home from './pages/Home';
import Demographics from './pages/Demographics';
import WorkloadAssessment from './pages/WorkloadAssessment';
import IPCAssessment from './pages/IPCAssessment';
import Results from './pages/Results';
import Submissions from './pages/Submissions';
import DataManager from './pages/DataManager';
import Analysis from './pages/Analysis';

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/assess" element={<Demographics />} />
          <Route path="/assess/workload" element={<WorkloadAssessment />} />
          <Route path="/assess/ipc" element={<IPCAssessment />} />
          <Route path="/assess/results" element={<Results />} />

          {/* Coordinator-only. The assessment itself stays open so nurses on a
              ward device never meet a login, which is what the protocol asks. */}
          <Route
            path="/submissions"
            element={
              <RequireCoordinator
                title="Submissions Register"
                description="Every assessment the study has received, with each participant's answers, ready to print."
              >
                <Submissions />
              </RequireCoordinator>
            }
          />
          <Route
            path="/data"
            element={
              <RequireCoordinator
                title="Data Manager"
                description="Review, export and exclude individual records."
              >
                <DataManager />
              </RequireCoordinator>
            }
          />
          <Route
            path="/analysis"
            element={
              <RequireCoordinator
                title="Analysis"
                description="Descriptive statistics, correlations and the full study report."
              >
                <Analysis />
              </RequireCoordinator>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
    </>
  );
}
