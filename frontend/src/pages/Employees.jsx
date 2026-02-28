import { useState, useEffect } from 'react';
import {
    PlusIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon,
    UserGroupIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon,
    XMarkIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);

const statusColors = {
    ACTIVE: 'badge-green',
    INACTIVE: 'badge-gray',
    RESIGNED: 'badge-red',
};

const emptyForm = {
    employee_code: '', first_name: '', last_name: '', nickname: '',
    position: '', department: '', phone: '', email: '', id_card: '',
    bank_account: '', bank_name: '', daily_wage: '', monthly_salary: '',
    start_date: '', end_date: '', status: 'ACTIVE', notes: '', project_ids: [],
};

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadEmployees();
        loadProjects();
        loadStats();
    }, []);

    const loadEmployees = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (statusFilter) params.set('status', statusFilter);
            const { data } = await api.get(`/employees?${params.toString()}`);
            setEmployees(data);
        } catch (err) {
            toast.error('Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    const loadProjects = async () => {
        try {
            const { data } = await api.get('/projects');
            setProjects(data);
        } catch (err) {
            console.error('Failed to load projects');
        }
    };

    const loadStats = async () => {
        try {
            const { data } = await api.get('/employees/stats/summary');
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats');
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => loadEmployees(), 300);
        return () => clearTimeout(timer);
    }, [search, statusFilter]);

    const openCreateModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (emp) => {
        setEditingId(emp.id);
        setForm({
            ...emptyForm,
            employee_code: emp.employee_code || '',
            first_name: emp.first_name || '',
            last_name: emp.last_name || '',
            nickname: emp.nickname || '',
            position: emp.position || '',
            department: emp.department || '',
            phone: emp.phone || '',
            email: emp.email || '',
            id_card: emp.id_card || '',
            bank_account: emp.bank_account || '',
            bank_name: emp.bank_name || '',
            daily_wage: emp.daily_wage || '',
            monthly_salary: emp.monthly_salary || '',
            start_date: emp.start_date ? emp.start_date.slice(0, 10) : '',
            end_date: emp.end_date ? emp.end_date.slice(0, 10) : '',
            status: emp.status || 'ACTIVE',
            notes: emp.notes || '',
            project_ids: (emp.projects || []).map(p => p.project_id),
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.employee_code || !form.first_name || !form.last_name) {
            toast.error('Please fill required fields');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                daily_wage: parseFloat(form.daily_wage) || 0,
                monthly_salary: parseFloat(form.monthly_salary) || 0,
            };
            if (editingId) {
                await api.put(`/employees/${editingId}`, payload);
                toast.success('Employee updated');
            } else {
                await api.post('/employees', payload);
                toast.success('Employee created');
            }
            setShowModal(false);
            loadEmployees();
            loadStats();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        try {
            await api.delete(`/employees/${id}`);
            toast.success('Employee deleted');
            loadEmployees();
            loadStats();
        } catch (err) {
            toast.error('Delete failed');
        }
    };

    const toggleProject = (pid) => {
        setForm(prev => ({
            ...prev,
            project_ids: prev.project_ids.includes(pid)
                ? prev.project_ids.filter(id => id !== pid)
                : [...prev.project_ids, pid],
        }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Employees</h1>
                    <p className="text-sm text-surface-500">จัดการข้อมูลพนักงาน</p>
                </div>
                <button onClick={openCreateModal} className="btn-primary">
                    <PlusIcon className="w-4 h-4" /> Add Employee
                </button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="kpi-card">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-surface-500 uppercase">Active Employees</p>
                                <p className="text-2xl font-bold text-surface-900 mt-1">{stats.active_count}</p>
                            </div>
                            <div className="p-2.5 bg-blue-50 rounded-xl">
                                <UserGroupIcon className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </div>
                    <div className="kpi-card">
                        <p className="text-xs font-medium text-surface-500 uppercase">Daily Wage Total</p>
                        <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.daily_wage_total)}</p>
                    </div>
                    <div className="kpi-card">
                        <p className="text-xs font-medium text-surface-500 uppercase">Monthly Salary Total</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.monthly_salary_total)}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text" placeholder="Search by name, code, nickname..."
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        className="input pl-10 w-full"
                    />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="RESIGNED">Resigned</option>
                </select>
            </div>

            {/* Table */}
            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Position</th>
                                <th>Department</th>
                                <th>Contact</th>
                                <th>Projects</th>
                                <th>Wage/Salary</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}><td colSpan={9}><div className="h-4 bg-surface-200 rounded animate-pulse"></div></td></tr>
                                ))
                            ) : employees.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-8 text-surface-400">
                                    No employees found
                                </td></tr>
                            ) : employees.map((emp) => (
                                <tr key={emp.id} className="group">
                                    <td className="font-mono text-xs font-medium">{emp.employee_code}</td>
                                    <td>
                                        <div>
                                            <p className="font-medium text-surface-800">{emp.first_name} {emp.last_name}</p>
                                            {emp.nickname && <p className="text-xs text-surface-400">({emp.nickname})</p>}
                                        </div>
                                    </td>
                                    <td className="text-surface-600">{emp.position || '-'}</td>
                                    <td className="text-surface-500">{emp.department || '-'}</td>
                                    <td>
                                        <div className="space-y-0.5">
                                            {emp.phone && <div className="flex items-center gap-1 text-xs text-surface-500"><PhoneIcon className="w-3 h-3" />{emp.phone}</div>}
                                            {emp.email && <div className="flex items-center gap-1 text-xs text-surface-500"><EnvelopeIcon className="w-3 h-3" />{emp.email}</div>}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex flex-wrap gap-1">
                                            {(emp.projects || []).length === 0 ? (
                                                <span className="text-xs text-surface-400">-</span>
                                            ) : (emp.projects || []).map((p, i) => (
                                                <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-brand-50 text-brand-700 rounded-md">
                                                    {p.project_code}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-xs">
                                            {parseFloat(emp.daily_wage) > 0 && <p className="text-surface-600">{formatCurrency(emp.daily_wage)}/day</p>}
                                            {parseFloat(emp.monthly_salary) > 0 && <p className="text-surface-600">{formatCurrency(emp.monthly_salary)}/mo</p>}
                                            {!parseFloat(emp.daily_wage) && !parseFloat(emp.monthly_salary) && <span className="text-surface-400">-</span>}
                                        </div>
                                    </td>
                                    <td><span className={statusColors[emp.status] || 'badge-gray'}>{emp.status}</span></td>
                                    <td>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(emp)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-brand-600 transition-colors">
                                                <PencilSquareIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(emp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 mb-10 animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
                            <h2 className="text-lg font-bold text-surface-900">
                                {editingId ? 'Edit Employee' : 'Add Employee'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-100 transition-colors">
                                <XMarkIcon className="w-5 h-5 text-surface-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Basic Info */}
                            <div>
                                <h3 className="text-sm font-semibold text-surface-700 mb-3">Basic Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Employee Code *</label>
                                        <input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} className="input mt-1" placeholder="EMP-001" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">First Name *</label>
                                        <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Last Name *</label>
                                        <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Nickname</label>
                                        <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="input mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Position</label>
                                        <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="input mt-1" placeholder="e.g. Foreman" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Department</label>
                                        <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input mt-1" placeholder="e.g. Construction" />
                                    </div>
                                </div>
                            </div>

                            {/* Contact */}
                            <div>
                                <h3 className="text-sm font-semibold text-surface-700 mb-3">Contact</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Phone</label>
                                        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input mt-1" placeholder="08x-xxx-xxxx" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Email</label>
                                        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input mt-1" type="email" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">ID Card</label>
                                        <input value={form.id_card} onChange={(e) => setForm({ ...form, id_card: e.target.value })} className="input mt-1" placeholder="x-xxxx-xxxxx-xx-x" />
                                    </div>
                                </div>
                            </div>

                            {/* Financial */}
                            <div>
                                <h3 className="text-sm font-semibold text-surface-700 mb-3">Compensation & Banking</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Daily Wage (฿)</label>
                                        <input value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: e.target.value })} className="input mt-1" type="number" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Monthly Salary (฿)</label>
                                        <input value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} className="input mt-1" type="number" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Bank Name</label>
                                        <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="input mt-1" placeholder="e.g. กสิกรไทย" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Bank Account</label>
                                        <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} className="input mt-1" />
                                    </div>
                                </div>
                            </div>

                            {/* Status & Dates */}
                            <div>
                                <h3 className="text-sm font-semibold text-surface-700 mb-3">Status & Dates</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Status</label>
                                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input mt-1">
                                            <option value="ACTIVE">Active</option>
                                            <option value="INACTIVE">Inactive</option>
                                            <option value="RESIGNED">Resigned</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">Start Date</label>
                                        <input value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input mt-1" type="date" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-surface-500">End Date</label>
                                        <input value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input mt-1" type="date" />
                                    </div>
                                </div>
                            </div>

                            {/* Project Assignment */}
                            <div>
                                <h3 className="text-sm font-semibold text-surface-700 mb-3">
                                    <BriefcaseIcon className="w-4 h-4 inline mr-1" />
                                    Assign to Projects
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {projects.map((proj) => (
                                        <button
                                            key={proj.id}
                                            type="button"
                                            onClick={() => toggleProject(proj.id)}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all border
                                                ${form.project_ids.includes(proj.id)
                                                    ? 'bg-brand-50 border-brand-300 text-brand-800'
                                                    : 'bg-white border-surface-200 text-surface-600 hover:border-surface-300'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                                ${form.project_ids.includes(proj.id) ? 'bg-brand-600 border-brand-600' : 'border-surface-300'}`}>
                                                {form.project_ids.includes(proj.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{proj.project_code}</p>
                                                <p className="text-xs text-surface-400 truncate">{proj.name}</p>
                                            </div>
                                        </button>
                                    ))}
                                    {projects.length === 0 && (
                                        <p className="text-sm text-surface-400 col-span-2">No projects available</p>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-medium text-surface-500">Notes</label>
                                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input mt-1" rows={2} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-100 bg-surface-50/50 rounded-b-2xl">
                            <button onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
