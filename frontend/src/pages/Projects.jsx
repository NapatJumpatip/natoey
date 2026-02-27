import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);

const statusColors = { PLANNING: 'badge-gray', ACTIVE: 'badge-green', ON_HOLD: 'badge-yellow', COMPLETED: 'badge-blue', CANCELLED: 'badge-red' };

export default function Projects() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ project_code: '', name: '', client: '', location: '', start_date: '', end_date: '', status: 'PLANNING', contract_value: '', vat_rate: '0.07' });

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const { data } = await api.get('/projects');
            setProjects(data);
        } catch (err) {
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/projects', { ...form, contract_value: parseFloat(form.contract_value) || 0, vat_rate: parseFloat(form.vat_rate) || 0.07 });
            toast.success('Project created');
            setShowModal(false);
            setForm({ project_code: '', name: '', client: '', location: '', start_date: '', end_date: '', status: 'PLANNING', contract_value: '', vat_rate: '0.07' });
            loadProjects();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create project');
        }
    };

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.project_code.toLowerCase().includes(search.toLowerCase()) ||
        (p.client || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Projects</h1>
                    <p className="text-sm text-surface-500">จัดการโครงการก่อสร้าง ({projects.length} โครงการ)</p>
                </div>
                {user?.role === 'ADMIN' && (
                    <button onClick={() => setShowModal(true)} className="btn-primary">
                        <PlusIcon className="w-4 h-4" /> New Project
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input type="text" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
            </div>

            {/* Project Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-48 animate-pulse"><div className="h-4 bg-surface-200 rounded w-3/4 mb-3"></div><div className="h-3 bg-surface-200 rounded w-1/2"></div></div>)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((project) => (
                        <div key={project.id} onClick={() => navigate(`/projects/${project.id}`)}
                            className="card p-5 cursor-pointer hover:border-brand-300 transition-all duration-200 group">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-xs font-mono text-surface-400">{project.project_code}</p>
                                    <h3 className="text-base font-semibold text-surface-900 group-hover:text-brand-700 transition-colors mt-0.5">{project.name}</h3>
                                </div>
                                <span className={statusColors[project.status] || 'badge-gray'}>{project.status}</span>
                            </div>
                            {project.client && <p className="text-sm text-surface-500 mb-1">👤 {project.client}</p>}
                            {project.location && <p className="text-sm text-surface-500 mb-3">📍 {project.location}</p>}
                            <div className="pt-3 border-t border-surface-100 grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <p className="text-xs text-surface-400">Contract</p>
                                    <p className="text-sm font-semibold text-surface-700">{formatCurrency(project.contract_value)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-surface-400">Income</p>
                                    <p className="text-sm font-semibold text-emerald-600">{formatCurrency(project.total_income)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-surface-400">Expense</p>
                                    <p className="text-sm font-semibold text-red-600">{formatCurrency(project.total_expense)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="p-6 border-b border-surface-100">
                            <h2 className="text-lg font-bold text-surface-900">Create New Project</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Project Code</label>
                                    <input className="input" placeholder="PRJ-2025-003" value={form.project_code} onChange={(e) => setForm({ ...form, project_code: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="PLANNING">Planning</option>
                                        <option value="ACTIVE">Active</option>
                                        <option value="ON_HOLD">On Hold</option>
                                        <option value="COMPLETED">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div><label className="label">Project Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                            <div><label className="label">Client</label><input className="input" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
                            <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                                <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label">Contract Value (THB)</label><input type="number" className="input" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} /></div>
                                <div><label className="label">VAT Rate</label><input type="number" step="0.01" className="input" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} /></div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">Create Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
