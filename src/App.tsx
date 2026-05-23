import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import Home from './pages/Home';
import Demographics from './pages/Demographics';
import WorkloadAssessment from './pages/WorkloadAssessment';
import IPCAssessment from './pages/IPCAssessment';
import Results from './pages/Results';
import DataManager from './pages/DataManager';
import Analysis from './pages/Analysis';

export default function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/assess" element={<Demographics />} />
          <Route path="/assess/workload" element={<WorkloadAssessment />} />
          <Route path="/assess/ipc" element={<IPCAssessment />} />
          <Route path="/assess/results" element={<Results />} />
          <Route path="/data" element={<DataManager />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
    </>
  );
}
