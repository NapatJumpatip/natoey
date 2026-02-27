import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Documents from './pages/Documents';
import DocumentForm from './pages/DocumentForm';
import TaxForms from './pages/TaxForms';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Help from './pages/Help';

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/new" element={<DocumentForm />} />
                <Route path="/documents/:id/edit" element={<DocumentForm />} />
                <Route path="/tax/:type" element={<TaxForms />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/help" element={<Help />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
}
