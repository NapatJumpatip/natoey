import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BanknotesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    DocumentPlusIcon, ShoppingCartIcon, ArrowDownTrayIcon,
    ExclamationTriangleIcon, CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../lib/api';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

const formatCurrency = (value) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value || 0);
};

export default function Dashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const { data: summary } = await api.get('/reports/summary');
                setData(summary);
            } catch (err) {
                toast.error('Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-5 h-28"><div className="h-4 bg-surface-200 rounded w-1/2 mb-3"></div><div className="h-6 bg-surface-200 rounded w-3/4"></div></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="card p-5 h-80 lg:col-span-2"></div>
                    <div className="card p-5 h-80"></div>
                </div>
            </div>
        );
    }

    const kpis = [
        { title: 'Outstanding Receivables', value: data?.outstanding_receivables, icon: BanknotesIcon, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
        { title: 'Outstanding Payables', value: data?.outstanding_payables, icon: ArrowTrendingDownIcon, color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-100' },
        { title: 'Monthly Profit', value: data?.monthly_profit, icon: ArrowTrendingUpIcon, color: data?.monthly_profit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data?.monthly_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50', ring: data?.monthly_profit >= 0 ? 'ring-emerald-100' : 'ring-red-100' },
        { title: 'VAT Payable', value: data?.vat_payable, icon: CurrencyDollarIcon, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
    ];

    const cashFlowData = (data?.cash_flow || []).map(cf => ({
        month: cf.month,
        'Cash In': parseFloat(cf.cash_in || 0),
        'Cash Out': parseFloat(cf.cash_out || 0),
    }));

    const expenseData = (data?.expense_by_category || []).map(ec => ({
        name: ec.category === 'PO' ? 'Purchase Orders' : ec.category === 'VENDOR_PAYMENT' ? 'Vendor Payments' : 'Advances',
        value: parseFloat(ec.total || 0),
    }));

    const profitData = (data?.cash_flow || []).map(cf => ({
        month: cf.month,
        profit: parseFloat(cf.cash_in || 0) - parseFloat(cf.cash_out || 0),
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
                    <p className="text-sm text-surface-500">ภาพรวมการเงินและโครงการ</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/documents/new?type=INVOICE')} className="btn-primary">
                        <DocumentPlusIcon className="w-4 h-4" /> New Invoice
                    </button>
                    <button onClick={() => navigate('/documents/new?type=PO')} className="btn-secondary">
                        <ShoppingCartIcon className="w-4 h-4" /> New PO
                    </button>
                    <button onClick={async () => {
                        try {
                            const token = localStorage.getItem('accessToken');
                            const apiUrl = import.meta.env.VITE_API_URL || '/api';
                            const res = await fetch(`${apiUrl}/reports/export?format=excel&type=vat-sales`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'NCON2559_vat-sales.xlsx';
                            a.click();
                            window.URL.revokeObjectURL(url);
                        } catch { toast.error('Export failed'); }
                    }} className="btn-ghost">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Export VAT
                    </button>
                </div>
            </div>

            {/* Overdue Alert */}
            {data?.overdue_count > 0 && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl animate-slide-up">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">
                        <span className="font-semibold">{data.overdue_count} documents</span> are past due date.
                        <button onClick={() => navigate('/documents?status=OVERDUE')} className="underline ml-1 hover:text-red-800">View overdue →</button>
                    </p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="kpi-card group" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{kpi.title}</p>
                                <p className={`text-2xl font-bold mt-2 ${kpi.color}`}>
                                    {formatCurrency(kpi.value)}
                                </p>
                            </div>
                            <div className={`p-2.5 ${kpi.bg} rounded-xl ring-1 ${kpi.ring} group-hover:scale-110 transition-transform`}>
                                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                            </div>
                        </div>
                        {kpi.title === 'VAT Payable' && (
                            <p className="text-xs text-surface-400 mt-2">WHT: {formatCurrency(data?.wht_payable)}</p>
                        )}
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cash Flow Chart */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Cash In vs Cash Out</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlowData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                <Legend />
                                <Bar dataKey="Cash In" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Cash Out" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense by Category */}
                <div className="card p-5">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Expense by Category</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={expenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                                    {expenseData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Profit Trend + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Profit Trend */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Profit Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={profitData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="card p-5">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Recent Activity</h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                        {(data?.recent_activity || []).map((activity) => {
                            const statusColors = {
                                PAID: 'badge-green', OVERDUE: 'badge-red', PENDING: 'badge-yellow',
                                APPROVED: 'badge-blue', DRAFT: 'badge-gray', CANCELLED: 'badge-gray',
                            };
                            return (
                                <div key={activity.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/documents/${activity.id}/edit`)}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-surface-800 truncate">{activity.doc_number}</p>
                                        <p className="text-xs text-surface-400 truncate">{activity.project_name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-surface-700">{formatCurrency(activity.net_total)}</p>
                                        <span className={statusColors[activity.status] || 'badge-gray'}>{activity.status}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {(!data?.recent_activity || data.recent_activity.length === 0) && (
                            <p className="text-sm text-surface-400 text-center py-8">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
