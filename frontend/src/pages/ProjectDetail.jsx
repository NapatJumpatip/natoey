import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);
const statusColors = { PAID: 'badge-green', OVERDUE: 'badge-red', PENDING: 'badge-yellow', APPROVED: 'badge-blue', DRAFT: 'badge-gray', CANCELLED: 'badge-gray' };

export default function ProjectDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('overview');

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get(`/projects/${id}`);
                setProject(data);
            } catch (err) {
                toast.error('Failed to load project');
                navigate('/projects');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div></div>;
    if (!project) return null;

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'documents', label: `Documents (${project.doc_count || 0})` },
        { id: 'team', label: `Team (${project.users?.length || 0})` },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="card p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-xs font-mono text-surface-400 mb-1">{project.project_code}</p>
                        <h1 className="text-2xl font-bold text-surface-900">{project.name}</h1>
                        <div className="flex items-center gap-4 mt-2 text-sm text-surface-500">
                            {project.client && <span>👤 {project.client}</span>}
                            {project.location && <span>📍 {project.location}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`${statusColors[project.status] || 'badge-gray'} text-sm px-3 py-1`}>{project.status}</span>
                        <button onClick={() => navigate(`/documents/new?project=${id}`)} className="btn-primary">+ New Document</button>
                    </div>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-surface-100">
                    <div>
                        <p className="text-xs text-surface-400">Contract Value</p>
                        <p className="text-lg font-bold text-surface-900">{formatCurrency(project.contract_value)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Total Income</p>
                        <p className="text-lg font-bold text-emerald-600">{formatCurrency(project.total_income)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Total Expense</p>
                        <p className="text-lg font-bold text-red-600">{formatCurrency(project.total_expense)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-surface-400">Net Profit</p>
                        <p className={`text-lg font-bold ${parseFloat(project.total_income) - parseFloat(project.total_expense) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(parseFloat(project.total_income) - parseFloat(project.total_expense))}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-surface-200">
                <div className="flex gap-1">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {tab === 'overview' && (
                <div className="card p-6">
                    <h3 className="font-semibold text-surface-900 mb-4">Project Details</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><dt className="text-xs text-surface-400">Start Date</dt><dd className="text-sm font-medium text-surface-700">{project.start_date || '-'}</dd></div>
                        <div><dt className="text-xs text-surface-400">End Date</dt><dd className="text-sm font-medium text-surface-700">{project.end_date || '-'}</dd></div>
                        <div><dt className="text-xs text-surface-400">VAT Rate</dt><dd className="text-sm font-medium text-surface-700">{(parseFloat(project.vat_rate) * 100).toFixed(0)}%</dd></div>
                        <div><dt className="text-xs text-surface-400">Documents</dt><dd className="text-sm font-medium text-surface-700">{project.doc_count}</dd></div>
                    </dl>
                </div>
            )}

            {tab === 'documents' && (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead><tr>
                                <th>Doc No.</th><th>Type</th><th>Amount</th><th>Status</th><th>Due Date</th>
                            </tr></thead>
                            <tbody>
                                {(project.recent_documents || []).map(doc => (
                                    <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}/edit`)} className="cursor-pointer">
                                        <td className="font-mono text-xs">{doc.doc_number}</td>
                                        <td><span className="badge-blue">{doc.doc_type}</span></td>
                                        <td className="font-semibold">{formatCurrency(doc.net_total)}</td>
                                        <td><span className={statusColors[doc.status] || 'badge-gray'}>{doc.status}</span></td>
                                        <td className="text-surface-500">{doc.due_date || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'team' && (
                <div className="card p-6">
                    <div className="space-y-3">
                        {(project.users || []).map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50">
                                <div className="w-10 h-10 bg-gradient-to-br from-brand-400 to-accent-500 rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">{u.name?.charAt(0)}</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-surface-900">{u.name}</p>
                                    <p className="text-xs text-surface-400">{u.email}</p>
                                </div>
                                <span className={`ml-auto ${u.role === 'ADMIN' ? 'badge-purple' : u.role === 'EDITOR' ? 'badge-blue' : 'badge-gray'}`}>{u.role}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
