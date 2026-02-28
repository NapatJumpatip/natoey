import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BanknotesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    DocumentPlusIcon, ShoppingCartIcon, ArrowDownTrayIcon,
    ExclamationTriangleIcon, CurrencyDollarIcon,
    LightBulbIcon, ArrowUpIcon, ArrowDownIcon,
    ChartBarSquareIcon, FolderIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import api from '../lib/api';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
const API_URL = import.meta.env.VITE_API_URL || '/api';

const formatCurrency = (value) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value || 0);
};
const formatCompact = (value) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value?.toFixed(0) || '0';
};

// ─── Mini Sparkline Component ───
function Sparkline({ data, dataKey, color, height = 32 }) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                    <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${color})`} dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ─── Insight Card Component ───
function InsightCard({ icon: Icon, title, description, type, action, onAction }) {
    const styles = {
        warning: { bg: 'bg-gradient-to-br from-red-50 to-orange-50', border: 'border-red-200', icon: 'text-red-500 bg-red-100', dot: 'bg-red-500' },
        success: { bg: 'bg-gradient-to-br from-emerald-50 to-teal-50', border: 'border-emerald-200', icon: 'text-emerald-500 bg-emerald-100', dot: 'bg-emerald-500' },
        info: { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', border: 'border-blue-200', icon: 'text-blue-500 bg-blue-100', dot: 'bg-blue-500' },
        neutral: { bg: 'bg-gradient-to-br from-surface-50 to-surface-100', border: 'border-surface-200', icon: 'text-surface-500 bg-surface-100', dot: 'bg-surface-400' },
    };
    const s = styles[type] || styles.neutral;
    return (
        <button onClick={onAction} className={`${s.bg} border ${s.border} rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-md hover:scale-[1.02] group w-full`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${s.icon} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`}></div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-surface-500">{title}</p>
                    </div>
                    <p className="text-sm text-surface-700 mt-1 leading-relaxed">{description}</p>
                </div>
            </div>
        </button>
    );
}

// ─── Project Health Card ───
function ProjectCard({ project, rank, type }) {
    const isProfit = type === 'profit';
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-colors group">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                ${rank === 1 ? 'bg-amber-100 text-amber-700' : rank === 2 ? 'bg-surface-200 text-surface-600' : 'bg-orange-100 text-orange-700'}`}>
                #{rank}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">{project.project_code}</p>
                <p className="text-xs text-surface-400 truncate">{project.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${isProfit ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(isProfit ? project.profit : project.totalExpense)}
                </p>
                <p className="text-[10px] text-surface-400">{isProfit ? 'profit' : 'expense'}</p>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [summaryRes, projectsRes] = await Promise.all([
                    api.get('/reports/summary'),
                    api.get('/projects'),
                ]);
                setData(summaryRes.data);
                setProjects(projectsRes.data);
            } catch (err) {
                toast.error('Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    // ─── Loading Skeleton ───
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-5 h-36">
                            <div className="h-3 bg-surface-200 rounded w-1/2 mb-3"></div>
                            <div className="h-7 bg-surface-200 rounded w-3/4 mb-3"></div>
                            <div className="h-8 bg-surface-100 rounded w-full"></div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="card p-4 h-24"></div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="card p-5 h-80 lg:col-span-2"></div>
                    <div className="card p-5 h-80"></div>
                </div>
            </div>
        );
    }

    // ─── Computed Data ───
    const cashFlow = (data?.cash_flow || []).map(cf => ({
        month: cf.month,
        'Cash In': parseFloat(cf.cash_in || 0),
        'Cash Out': parseFloat(cf.cash_out || 0),
        profit: parseFloat(cf.cash_in || 0) - parseFloat(cf.cash_out || 0),
    }));

    const expenseData = (data?.expense_by_category || []).map(ec => ({
        name: ec.category === 'PO' ? 'Purchase Orders' : ec.category === 'VENDOR_PAYMENT' ? 'Vendor Payments' : 'Advances',
        value: parseFloat(ec.total || 0),
    }));

    // Monthly comparison: latest 2 months
    const currentMonth = cashFlow[cashFlow.length - 1];
    const prevMonth = cashFlow[cashFlow.length - 2];
    const incomeChange = currentMonth && prevMonth ? ((currentMonth['Cash In'] - prevMonth['Cash In']) / (prevMonth['Cash In'] || 1)) * 100 : 0;
    const expenseChange = currentMonth && prevMonth ? ((currentMonth['Cash Out'] - prevMonth['Cash Out']) / (prevMonth['Cash Out'] || 1)) * 100 : 0;
    const profitChange = currentMonth && prevMonth ? ((currentMonth.profit - prevMonth.profit) / (Math.abs(prevMonth.profit) || 1)) * 100 : 0;

    // Sparkline data for each KPI
    const receivableSpark = cashFlow.map(cf => ({ v: cf['Cash In'] }));
    const payableSpark = cashFlow.map(cf => ({ v: cf['Cash Out'] }));
    const profitSpark = cashFlow.map(cf => ({ v: cf.profit }));
    const vatSpark = cashFlow.map((_, i) => ({ v: (data?.vat_payable || 0) * (0.8 + Math.random() * 0.4) }));

    // Project health
    const projectsWithFinancials = projects.map(p => ({
        ...p,
        totalIncome: parseFloat(p.total_income || 0),
        totalExpense: parseFloat(p.total_expense || 0),
        profit: parseFloat(p.total_income || 0) - parseFloat(p.total_expense || 0),
    }));
    const topProfitable = [...projectsWithFinancials].sort((a, b) => b.profit - a.profit).slice(0, 3);
    const highestExpense = [...projectsWithFinancials].sort((a, b) => b.totalExpense - a.totalExpense)[0];

    // ─── Smart Insights ───
    const insights = [];
    if (data?.overdue_count > 0) {
        insights.push({
            icon: ExclamationTriangleIcon,
            title: 'Overdue Alert',
            description: `${data.overdue_count} documents are past due. Review and follow up to maintain cash flow.`,
            type: 'warning',
            action: () => navigate('/documents?status=OVERDUE'),
        });
    }
    if (profitChange > 0) {
        insights.push({
            icon: ArrowTrendingUpIcon,
            title: 'Profit Trending Up',
            description: `Monthly profit increased ${profitChange.toFixed(0)}% compared to last month. Great momentum!`,
            type: 'success',
            action: () => { },
        });
    } else if (profitChange < -10) {
        insights.push({
            icon: ArrowTrendingDownIcon,
            title: 'Profit Declining',
            description: `Monthly profit dropped ${Math.abs(profitChange).toFixed(0)}%. Consider reviewing expenses.`,
            type: 'warning',
            action: () => navigate('/reports'),
        });
    }
    if (data?.outstanding_payables > data?.outstanding_receivables) {
        insights.push({
            icon: CurrencyDollarIcon,
            title: 'Payables Exceed Receivables',
            description: `Outstanding payables (${formatCurrency(data.outstanding_payables)}) exceed receivables. Monitor cash flow carefully.`,
            type: 'warning',
            action: () => navigate('/documents?type=PO'),
        });
    }
    if (topProfitable.length > 0 && topProfitable[0].profit > 0) {
        insights.push({
            icon: SparklesIcon,
            title: 'Top Performer',
            description: `${topProfitable[0].project_code} leads with ${formatCurrency(topProfitable[0].profit)} profit.`,
            type: 'success',
            action: () => navigate(`/projects/${topProfitable[0].id}`),
        });
    }

    // ─── KPI Config ───
    const kpis = [
        {
            title: 'Outstanding Receivables', subtitle: 'ลูกหนี้การค้า',
            value: data?.outstanding_receivables, icon: BanknotesIcon,
            color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100',
            sparkData: receivableSpark, sparkColor: '#3b82f6',
            change: incomeChange, tooltip: 'Total unpaid invoices & tax invoices from clients.',
        },
        {
            title: 'Outstanding Payables', subtitle: 'เจ้าหนี้การค้า',
            value: data?.outstanding_payables, icon: ArrowTrendingDownIcon,
            color: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-100',
            sparkData: payableSpark, sparkColor: '#ef4444',
            change: expenseChange, tooltip: 'Total unpaid POs & vendor payments.',
        },
        {
            title: 'Monthly Profit', subtitle: 'กำไรเดือนนี้',
            value: data?.monthly_profit, icon: ArrowTrendingUpIcon,
            color: data?.monthly_profit >= 0 ? 'text-emerald-600' : 'text-red-600',
            bg: data?.monthly_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
            ring: data?.monthly_profit >= 0 ? 'ring-emerald-100' : 'ring-red-100',
            sparkData: profitSpark, sparkColor: data?.monthly_profit >= 0 ? '#10b981' : '#ef4444',
            change: profitChange, tooltip: 'Income minus expenses this month.',
        },
        {
            title: 'VAT Payable', subtitle: 'ภาษีมูลค่าเพิ่ม',
            value: data?.vat_payable, icon: CurrencyDollarIcon,
            color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100',
            sparkData: vatSpark, sparkColor: '#f59e0b',
            change: 0, tooltip: 'Net VAT = VAT from sales - VAT from purchases.',
            extra: `WHT: ${formatCurrency(data?.wht_payable)}`,
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ─── Header ─── */}
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
                            const res = await fetch(`${API_URL}/reports/export?format=excel&type=vat-sales`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'NCON2559_vat-sales.xlsx';
                            a.click();
                            window.URL.revokeObjectURL(url);
                            toast.success('Export downloaded');
                        } catch { toast.error('Export failed'); }
                    }} className="btn-ghost">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* ─── Smart Insights ─── */}
            {insights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {insights.slice(0, 4).map((insight, i) => (
                        <InsightCard key={i} {...insight} onAction={insight.action} />
                    ))}
                </div>
            )}

            {/* ─── KPI Cards with Sparklines ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="kpi-card group relative overflow-hidden" style={{ animationDelay: `${i * 50}ms` }} title={kpi.tooltip}>
                        <div className="flex items-start justify-between relative z-10">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{kpi.title}</p>
                                <p className="text-[10px] text-surface-400">{kpi.subtitle}</p>
                                <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>
                                    {formatCurrency(kpi.value)}
                                </p>
                                {/* Change indicator */}
                                {kpi.change !== 0 && (
                                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium
                                        ${kpi.change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {kpi.change > 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                        {Math.abs(kpi.change).toFixed(1)}% vs last month
                                    </div>
                                )}
                                {kpi.extra && <p className="text-xs text-surface-400 mt-1">{kpi.extra}</p>}
                            </div>
                            <div className={`p-2.5 ${kpi.bg} rounded-xl ring-1 ${kpi.ring} group-hover:scale-110 transition-transform`}>
                                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                            </div>
                        </div>
                        {/* Sparkline */}
                        <div className="mt-2 -mx-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Sparkline data={kpi.sparkData} dataKey="v" color={kpi.sparkColor} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Monthly Comparison ─── */}
            {currentMonth && prevMonth && (
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ChartBarSquareIcon className="w-5 h-5 text-brand-500" />
                        <h3 className="text-sm font-semibold text-surface-900">Monthly Comparison</h3>
                        <span className="text-xs text-surface-400 ml-auto">{prevMonth.month} vs {currentMonth.month}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Income', prev: prevMonth['Cash In'], curr: currentMonth['Cash In'], color: 'blue' },
                            { label: 'Expense', prev: prevMonth['Cash Out'], curr: currentMonth['Cash Out'], color: 'amber' },
                            { label: 'Profit', prev: prevMonth.profit, curr: currentMonth.profit, color: currentMonth.profit >= 0 ? 'emerald' : 'red' },
                        ].map((item, i) => {
                            const pct = item.prev ? ((item.curr - item.prev) / Math.abs(item.prev)) * 100 : 0;
                            return (
                                <div key={i} className={`rounded-xl bg-${item.color}-50/50 p-4 border border-${item.color}-100`}>
                                    <p className="text-xs font-medium text-surface-500 uppercase">{item.label}</p>
                                    <div className="flex items-end justify-between mt-2">
                                        <div>
                                            <p className={`text-lg font-bold text-${item.color}-600`}>{formatCompact(item.curr)}</p>
                                            <p className="text-[10px] text-surface-400">prev: {formatCompact(item.prev)}</p>
                                        </div>
                                        <div className={`flex items-center gap-0.5 text-xs font-semibold ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {pct >= 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                            {Math.abs(pct).toFixed(0)}%
                                        </div>
                                    </div>
                                    {/* Mini bar comparison */}
                                    <div className="mt-2 flex gap-1 h-2">
                                        <div className="bg-surface-300 rounded-full" style={{ width: `${Math.min((item.prev / Math.max(item.curr, item.prev, 1)) * 100, 100)}%` }}></div>
                                        <div className={`bg-${item.color}-500 rounded-full`} style={{ width: `${Math.min((item.curr / Math.max(item.curr, item.prev, 1)) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── Charts Row ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cash Flow */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Cash In vs Cash Out</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlow} barGap={4}>
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
                        {expenseData.length > 0 ? (
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
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                        <ChartBarSquareIcon className="w-8 h-8 text-surface-300" />
                                    </div>
                                    <p className="text-sm text-surface-400">No expense data yet</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Project Health + Profit Trend + Recent Activity ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Profit Trend */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-semibold text-surface-900 mb-4">Profit Trend</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cashFlow}>
                                <defs>
                                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGrad)" dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Project Health Summary */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <FolderIcon className="w-5 h-5 text-brand-500" />
                        <h3 className="text-sm font-semibold text-surface-900">Project Health</h3>
                    </div>

                    {projectsWithFinancials.length > 0 ? (
                        <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Most Profitable</p>
                            {topProfitable.map((p, i) => (
                                <ProjectCard key={p.id} project={p} rank={i + 1} type="profit" />
                            ))}

                            {highestExpense && (
                                <>
                                    <div className="border-t border-surface-100 my-3"></div>
                                    <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Highest Expense</p>
                                    <ProjectCard project={highestExpense} rank={1} type="expense" />
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-48">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                    <FolderIcon className="w-7 h-7 text-surface-300" />
                                </div>
                                <p className="text-sm text-surface-400">No projects yet</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Recent Activity ─── */}
            <div className="card p-5">
                <h3 className="text-sm font-semibold text-surface-900 mb-4">Recent Activity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(data?.recent_activity || []).map((activity) => {
                        const statusColors = {
                            PAID: 'badge-green', OVERDUE: 'badge-red', PENDING: 'badge-yellow',
                            APPROVED: 'badge-blue', DRAFT: 'badge-gray', CANCELLED: 'badge-gray',
                        };
                        return (
                            <div key={activity.id}
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-surface-200"
                                onClick={() => navigate(`/documents/${activity.id}/edit`)}>
                                <div className="w-9 h-9 bg-gradient-to-br from-brand-50 to-accent-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <DocumentPlusIcon className="w-4 h-4 text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-surface-800 truncate">{activity.doc_number}</p>
                                    <p className="text-xs text-surface-400 truncate">{activity.project_name}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-semibold text-surface-700">{formatCurrency(activity.net_total)}</p>
                                    <span className={statusColors[activity.status] || 'badge-gray'}>{activity.status}</span>
                                </div>
                            </div>
                        );
                    })}
                    {(!data?.recent_activity || data.recent_activity.length === 0) && (
                        <div className="col-span-full text-center py-8">
                            <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <DocumentPlusIcon className="w-8 h-8 text-surface-300" />
                            </div>
                            <p className="text-sm text-surface-400">No recent activity</p>
                            <button onClick={() => navigate('/documents/new?type=INVOICE')} className="btn-primary mt-3 text-xs">
                                Create your first document
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
