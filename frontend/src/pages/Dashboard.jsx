import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BanknotesIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon,
    DocumentPlusIcon, ShoppingCartIcon, ArrowDownTrayIcon,
    ExclamationTriangleIcon, CurrencyDollarIcon,
    ArrowUpIcon, ArrowDownIcon, ChartBarSquareIcon,
    FolderIcon, SparklesIcon, ShieldCheckIcon,
    BoltIcon, ArrowPathIcon, EyeIcon,
} from '@heroicons/react/24/outline';
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../lib/api';
import toast from 'react-hot-toast';

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Utilities ───
const fmt = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);
const fmtK = (v) => {
    if (Math.abs(v) >= 1e6) return `฿${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `฿${(v / 1e3).toFixed(0)}K`;
    return `฿${(v || 0).toFixed(0)}`;
};

// ═══════════════════════════════════════
// ANIMATED NUMBER (count-up effect)
// ═══════════════════════════════════════
function AnimatedNumber({ value, duration = 1200, prefix = '฿', formatter }) {
    const [display, setDisplay] = useState(0);
    const startRef = useRef(null);
    const prevRef = useRef(0);

    useEffect(() => {
        const start = prevRef.current;
        const end = value || 0;
        prevRef.current = end;
        const diff = end - start;
        if (diff === 0) { setDisplay(end); return; }

        let raf;
        const animate = (ts) => {
            if (!startRef.current) startRef.current = ts;
            const elapsed = ts - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setDisplay(start + diff * eased);
            if (progress < 1) raf = requestAnimationFrame(animate);
        };
        startRef.current = null;
        raf = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(raf);
    }, [value, duration]);

    if (formatter) return <>{formatter(display)}</>;
    return <>{prefix}{Math.round(display).toLocaleString('th-TH')}</>;
}

// ═══════════════════════════════════════
// FINANCIAL HEALTH GAUGE (0–100)
// ═══════════════════════════════════════
function HealthGauge({ score }) {
    const clampedScore = Math.min(100, Math.max(0, score));
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (clampedScore / 100) * circumference * 0.75; // 270° arc
    const color = clampedScore >= 70 ? '#10b981' : clampedScore >= 40 ? '#f59e0b' : '#ef4444';
    const label = clampedScore >= 70 ? 'Healthy' : clampedScore >= 40 ? 'Caution' : 'At Risk';
    const [animated, setAnimated] = useState(circumference);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(offset), 100);
        return () => clearTimeout(t);
    }, [offset]);

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-36 h-36">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[135deg]">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="8"
                        strokeDasharray={circumference} strokeDashoffset={circumference * 0.25}
                        strokeLinecap="round" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="8"
                        strokeDasharray={circumference} strokeDashoffset={animated}
                        strokeLinecap="round" className="transition-all duration-[1500ms] ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-surface-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(clampedScore)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>{label}</span>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════
// MINI SPARKLINE
// ═══════════════════════════════════════
function Sparkline({ data, dataKey, color, height = 36 }) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                    <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
                    fill={`url(#sp-${color.replace('#', '')})`} dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ═══════════════════════════════════════
// EXECUTIVE INSIGHT CARD
// ═══════════════════════════════════════
const insightStyles = {
    critical: { bg: 'from-red-500/10 to-orange-500/10', border: 'border-red-200/60', dot: 'bg-red-500', icon: 'text-red-500' },
    positive: { bg: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200/60', dot: 'bg-emerald-500', icon: 'text-emerald-500' },
    warning: { bg: 'from-amber-500/10 to-yellow-500/10', border: 'border-amber-200/60', dot: 'bg-amber-500', icon: 'text-amber-500' },
    info: { bg: 'from-blue-500/10 to-indigo-500/10', border: 'border-blue-200/60', dot: 'bg-blue-500', icon: 'text-blue-500' },
};

function InsightCard({ icon: Icon, label, message, severity, onClick, delay = 0 }) {
    const s = insightStyles[severity] || insightStyles.info;
    return (
        <button onClick={onClick}
            className={`relative bg-gradient-to-br ${s.bg} border ${s.border} rounded-2xl p-4 text-left w-full
            transition-all duration-300 hover:shadow-lg hover:shadow-surface-200/50 hover:-translate-y-0.5 group`}
            style={{ animationDelay: `${delay}ms` }}>
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-white/80 shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className={`w-4 h-4 ${s.icon}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`}></span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">{label}</p>
                    </div>
                    <p className="text-sm text-surface-700 leading-relaxed">{message}</p>
                </div>
            </div>
        </button>
    );
}

// ═══════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════
export default function Dashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [s, p] = await Promise.all([api.get('/reports/summary'), api.get('/projects')]);
                setData(s.data);
                setProjects(p.data);
            } catch { toast.error('Failed to load dashboard'); }
            finally { setLoading(false); }
        })();
    }, []);

    // ─── SKELETON ───
    if (loading) {
        return (
            <div className="space-y-6">
                {/* Header skeleton */}
                <div className="flex justify-between items-center">
                    <div><div className="h-7 bg-surface-200 rounded-lg w-56 animate-pulse"></div>
                        <div className="h-4 bg-surface-100 rounded w-40 mt-2 animate-pulse"></div></div>
                    <div className="flex gap-2"><div className="h-10 bg-surface-200 rounded-xl w-28 animate-pulse"></div>
                        <div className="h-10 bg-surface-100 rounded-xl w-24 animate-pulse"></div></div>
                </div>
                {/* Insight skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-surface-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }}></div>)}
                </div>
                {/* KPI skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-surface-200/60 p-5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className="h-3 bg-surface-200 rounded w-2/3 mb-3"></div>
                            <div className="h-8 bg-surface-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-surface-100 rounded w-1/2 mb-3"></div>
                            <div className="h-9 bg-surface-50 rounded w-full"></div>
                        </div>
                    ))}
                </div>
                {/* Charts skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-surface-200/60 p-5 h-80 animate-pulse"></div>
                    <div className="bg-white rounded-2xl border border-surface-200/60 p-5 h-80 animate-pulse"></div>
                </div>
            </div>
        );
    }

    // ─── COMPUTED DATA ───
    const cashFlow = (data?.cash_flow || []).map(cf => ({
        month: cf.month?.slice(5), // "MM"
        label: cf.month,
        income: parseFloat(cf.cash_in || 0),
        expense: parseFloat(cf.cash_out || 0),
        profit: parseFloat(cf.cash_in || 0) - parseFloat(cf.cash_out || 0),
    }));

    const expenseData = (data?.expense_by_category || []).map(ec => ({
        name: ec.category === 'PO' ? 'Purchase Orders' : ec.category === 'VENDOR_PAYMENT' ? 'Vendor Payments' : 'Advances',
        value: parseFloat(ec.total || 0),
    }));

    const cur = cashFlow[cashFlow.length - 1];
    const prev = cashFlow[cashFlow.length - 2];
    const pctChange = (c, p, key) => p && p[key] ? ((c[key] - p[key]) / Math.abs(p[key])) * 100 : 0;
    const incChg = cur && prev ? pctChange(cur, prev, 'income') : 0;
    const expChg = cur && prev ? pctChange(cur, prev, 'expense') : 0;
    const profChg = cur && prev ? pctChange(cur, prev, 'profit') : 0;

    const incSpark = cashFlow.map(c => ({ v: c.income }));
    const expSpark = cashFlow.map(c => ({ v: c.expense }));
    const profSpark = cashFlow.map(c => ({ v: c.profit }));

    // Project financials
    const projFin = projects.map(p => ({
        ...p,
        income: parseFloat(p.total_income || 0),
        expense: parseFloat(p.total_expense || 0),
        profit: parseFloat(p.total_income || 0) - parseFloat(p.total_expense || 0),
    }));
    const topProfit = [...projFin].sort((a, b) => b.profit - a.profit).slice(0, 5);
    const topExpense = [...projFin].sort((a, b) => b.expense - a.expense)[0];

    // ─── FINANCIAL HEALTH SCORE ───
    const calcHealthScore = () => {
        let score = 50;
        const recv = data?.outstanding_receivables || 0;
        const payb = data?.outstanding_payables || 0;
        if (recv > payb) score += 15; else if (payb > recv * 2) score -= 20; else score -= 5;
        if (data?.monthly_profit > 0) score += 15; else if (data?.monthly_profit < 0) score -= 15;
        if (data?.overdue_count === 0) score += 10; else if (data?.overdue_count > 5) score -= 15; else score -= 5;
        if (profChg > 0) score += 10; else if (profChg < -20) score -= 10;
        return Math.min(100, Math.max(0, score));
    };
    const healthScore = calcHealthScore();

    // ─── SMART INSIGHTS ───
    const insights = [];
    if (data?.overdue_count > 0) {
        insights.push({
            icon: ExclamationTriangleIcon, label: 'Action Required', severity: 'critical',
            message: `${data.overdue_count} documents overdue — collect ${fmt(data.outstanding_receivables)} to improve your cash position.`,
            onClick: () => navigate('/documents?status=OVERDUE')
        });
    }
    if (profChg > 5) {
        insights.push({
            icon: ArrowTrendingUpIcon, label: 'Positive Momentum', severity: 'positive',
            message: `Profit grew ${profChg.toFixed(0)}% month-over-month. Revenue engine is accelerating.`,
            onClick: () => { }
        });
    } else if (profChg < -10) {
        insights.push({
            icon: ArrowTrendingDownIcon, label: 'Margin Pressure', severity: 'warning',
            message: `Profit declined ${Math.abs(profChg).toFixed(0)}%. Review cost drivers and negotiate vendor terms.`,
            onClick: () => navigate('/reports')
        });
    }
    if ((data?.outstanding_payables || 0) > (data?.outstanding_receivables || 0) * 1.5) {
        insights.push({
            icon: CurrencyDollarIcon, label: 'Cash Flow Risk', severity: 'warning',
            message: `Payables exceed receivables by ${fmt((data?.outstanding_payables || 0) - (data?.outstanding_receivables || 0))}. Prioritize collections.`,
            onClick: () => navigate('/documents?type=PO')
        });
    }
    if (topProfit[0]?.profit > 0) {
        insights.push({
            icon: SparklesIcon, label: 'Star Project', severity: 'positive',
            message: `${topProfit[0].project_code} leads with ${fmt(topProfit[0].profit)} net profit — your best performer this period.`,
            onClick: () => navigate(`/projects/${topProfit[0].id}`)
        });
    }
    if (insights.length < 4 && healthScore >= 70) {
        insights.push({
            icon: ShieldCheckIcon, label: 'Financial Health', severity: 'info',
            message: `Health score is ${healthScore}/100 — your finances are in solid shape. Keep monitoring.`,
            onClick: () => { }
        });
    }

    // ─── KPI CONFIG ───
    const kpis = [
        {
            title: 'Receivables', sub: 'ลูกหนี้การค้า', value: data?.outstanding_receivables || 0,
            icon: BanknotesIcon, color: '#3b82f6', change: incChg, spark: incSpark,
            tooltip: 'Total unpaid invoices from clients'
        },
        {
            title: 'Payables', sub: 'เจ้าหนี้การค้า', value: data?.outstanding_payables || 0,
            icon: ArrowTrendingDownIcon, color: '#ef4444', change: expChg, spark: expSpark,
            tooltip: 'Total unpaid vendor obligations'
        },
        {
            title: 'Monthly Profit', sub: 'กำไร/ขาดทุน', value: data?.monthly_profit || 0,
            icon: ArrowTrendingUpIcon, color: (data?.monthly_profit || 0) >= 0 ? '#10b981' : '#ef4444',
            change: profChg, spark: profSpark, tooltip: 'Income less expenses this month'
        },
        {
            title: 'VAT Payable', sub: 'ภาษีมูลค่าเพิ่ม', value: data?.vat_payable || 0,
            icon: CurrencyDollarIcon, color: '#f59e0b', change: 0, spark: incSpark,
            tooltip: 'Net VAT owed to Revenue Department', extra: `WHT ${fmt(data?.wht_payable)}`
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* ═══ HEADER ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/25">
                            <BoltIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-surface-900 tracking-tight">Command Center</h1>
                            <p className="text-xs text-surface-400 font-medium">Real-time financial overview • NCON2559</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setLoading(true); setTimeout(() => window.location.reload(), 200); }}
                        className="p-2.5 rounded-xl border border-surface-200 hover:bg-surface-50 transition-all text-surface-400 hover:text-surface-600">
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => navigate('/documents/new?type=INVOICE')} className="btn-primary">
                        <DocumentPlusIcon className="w-4 h-4" /> Invoice
                    </button>
                    <button onClick={() => navigate('/documents/new?type=PO')} className="btn-secondary">
                        <ShoppingCartIcon className="w-4 h-4" /> PO
                    </button>
                    <button onClick={async () => {
                        try {
                            const token = localStorage.getItem('accessToken');
                            const res = await fetch(`${API_URL}/reports/export?format=excel&type=vat-sales`, { headers: { 'Authorization': `Bearer ${token}` } });
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = 'NCON2559_vat-sales.xlsx'; a.click();
                            window.URL.revokeObjectURL(url); toast.success('Exported');
                        } catch { toast.error('Export failed'); }
                    }} className="btn-ghost">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ═══ SMART INSIGHTS ═══ */}
            {insights.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <SparklesIcon className="w-4 h-4 text-brand-500" />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-surface-400">Smart Insights</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {insights.slice(0, 4).map((ins, i) => <InsightCard key={i} {...ins} delay={i * 80} />)}
                    </div>
                </section>
            )}

            {/* ═══ KPI CARDS ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => {
                    const isUp = kpi.change > 0;
                    return (
                        <div key={i} title={kpi.tooltip}
                            className="relative bg-white rounded-2xl border border-surface-200/60 p-5 overflow-hidden
                            shadow-sm hover:shadow-xl hover:shadow-surface-200/50 hover:-translate-y-0.5
                            transition-all duration-300 group"
                            style={{ animationDelay: `${i * 60}ms` }}>
                            {/* Top accent line */}
                            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${kpi.color}, transparent)` }}></div>

                            <div className="flex items-start justify-between mb-1">
                                <div>
                                    <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">{kpi.title}</p>
                                    <p className="text-[10px] text-surface-300">{kpi.sub}</p>
                                </div>
                                {/* Trend badge (replaces decorative dot) */}
                                {kpi.change !== 0 ? (
                                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-transform group-hover:scale-105
                                        ${isUp ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60' : 'bg-red-50 text-red-500 ring-1 ring-red-200/60'}`}>
                                        {isUp ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                                        {Math.abs(kpi.change).toFixed(1)}%
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
                                        bg-surface-50 text-surface-400 ring-1 ring-surface-200/60 transition-transform group-hover:scale-105">
                                        <kpi.icon className="w-3 h-3" />
                                        <span>stable</span>
                                    </div>
                                )}
                            </div>

                            {/* Animated Value */}
                            <p className="text-[26px] font-black tracking-tight text-surface-900 mt-2"
                                style={{ fontVariantNumeric: 'tabular-nums' }}>
                                <AnimatedNumber value={kpi.value} />
                            </p>

                            {/* Context line */}
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-surface-300">
                                    {kpi.change !== 0 ? `${isUp ? '↑' : '↓'} vs last month` : 'vs last month'}
                                </span>
                            </div>
                            {kpi.extra && <p className="text-[10px] text-surface-400 mt-0.5">{kpi.extra}</p>}

                            {/* Sparkline */}
                            <div className="mt-3 -mx-2 opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                                <Sparkline data={kpi.spark} dataKey="v" color={kpi.color} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ═══ HEALTH SCORE + MONTHLY COMPARISON ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Health Gauge */}
                <div className="card p-6 flex flex-col items-center justify-center">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-surface-400 mb-4">Financial Health</h3>
                    <HealthGauge score={healthScore} />
                    <div className="mt-4 grid grid-cols-3 gap-3 w-full text-center">
                        <div>
                            <p className="text-[10px] text-surface-400">Income</p>
                            <p className="text-xs font-bold text-surface-700">{fmtK(data?.monthly_income || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-surface-400">Expense</p>
                            <p className="text-xs font-bold text-surface-700">{fmtK(data?.monthly_expense || 0)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-surface-400">Overdue</p>
                            <p className={`text-xs font-bold ${data?.overdue_count > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{data?.overdue_count || 0}</p>
                        </div>
                    </div>
                </div>

                {/* Monthly Comparison */}
                {cur && prev && (
                    <div className="card p-5 lg:col-span-3">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <ChartBarSquareIcon className="w-5 h-5 text-brand-500" />
                                <h3 className="text-sm font-bold text-surface-900">Monthly Comparison</h3>
                            </div>
                            <span className="text-[10px] font-medium text-surface-400 bg-surface-50 px-2 py-1 rounded-lg">
                                {prev.label} → {cur.label}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { label: 'Income', key: 'income', c: cur.income, p: prev.income, clr: '#3b82f6' },
                                { label: 'Expense', key: 'expense', c: cur.expense, p: prev.expense, clr: '#f59e0b' },
                                { label: 'Profit', key: 'profit', c: cur.profit, p: prev.profit, clr: cur.profit >= 0 ? '#10b981' : '#ef4444' },
                            ].map((item, i) => {
                                const pct = item.p ? ((item.c - item.p) / Math.abs(item.p)) * 100 : 0;
                                const up = pct >= 0;
                                const maxVal = Math.max(Math.abs(item.c), Math.abs(item.p), 1);
                                return (
                                    <div key={i} className="rounded-xl p-4 border border-surface-100 bg-surface-50/50 hover:bg-surface-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400">{item.label}</p>
                                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {up ? <ArrowUpIcon className="w-2.5 h-2.5" /> : <ArrowDownIcon className="w-2.5 h-2.5" />}
                                                {Math.abs(pct).toFixed(0)}%
                                            </span>
                                        </div>
                                        <p className="text-xl font-black text-surface-900 mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                            <AnimatedNumber value={item.c} duration={1000} />
                                        </p>
                                        <p className="text-[10px] text-surface-400 mt-0.5">prev: {fmtK(item.p)}</p>
                                        {/* Comparison bars */}
                                        <div className="flex gap-1.5 mt-3 items-end h-3">
                                            <div className="rounded-full bg-surface-300 transition-all duration-700"
                                                style={{ width: `${(Math.abs(item.p) / maxVal) * 100}%`, height: '6px' }}></div>
                                            <div className="rounded-full transition-all duration-700"
                                                style={{ width: `${(Math.abs(item.c) / maxVal) * 100}%`, height: '10px', backgroundColor: item.clr }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ CHARTS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cash Flow */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-bold text-surface-900 mb-1">Cash Flow</h3>
                    <p className="text-[10px] text-surface-400 mb-4">รายรับ-รายจ่ายรายเดือน</p>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={cashFlow} barGap={2} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="income" name="Cash In" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="expense" name="Cash Out" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense Pie */}
                <div className="card p-5">
                    <h3 className="text-sm font-bold text-surface-900 mb-1">Expense Breakdown</h3>
                    <p className="text-[10px] text-surface-400 mb-4">สัดส่วนค่าใช้จ่าย</p>
                    <div className="h-72">
                        {expenseData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={expenseData} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value" cornerRadius={4}>
                                        {expenseData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0' }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center"><div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-3"><ChartBarSquareIcon className="w-8 h-8 text-surface-200" /></div><p className="text-xs text-surface-300">No expense data</p></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ PROFIT TREND + TOP PROJECTS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Profit Trend */}
                <div className="card p-5 lg:col-span-2">
                    <h3 className="text-sm font-bold text-surface-900 mb-1">Profit Trend</h3>
                    <p className="text-[10px] text-surface-400 mb-4">แนวโน้มกำไรสุทธิ</p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cashFlow}>
                                <defs>
                                    <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtK(v)} />
                                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0' }} />
                                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profGrad)"
                                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Projects */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <FolderIcon className="w-5 h-5 text-brand-500" />
                        <div>
                            <h3 className="text-sm font-bold text-surface-900">Top Projects</h3>
                            <p className="text-[10px] text-surface-400">Ranked by profitability</p>
                        </div>
                    </div>

                    {topProfit.length > 0 ? (
                        <div className="space-y-1">
                            {topProfit.map((p, i) => {
                                const medals = ['🥇', '🥈', '🥉', '4', '5'];
                                const maxProfit = Math.max(topProfit[0]?.profit || 1, 1);
                                return (
                                    <button key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-all group text-left">
                                        <span className="text-lg w-7 text-center flex-shrink-0">{medals[i]}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-surface-800 truncate group-hover:text-brand-600 transition-colors">{p.project_code}</p>
                                            <p className="text-[10px] text-surface-400 truncate">{p.name}</p>
                                            {/* Profit bar */}
                                            <div className="mt-1.5 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700"
                                                    style={{ width: `${Math.max((p.profit / maxProfit) * 100, 5)}%` }}></div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className={`text-sm font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtK(p.profit)}</p>
                                            <p className="text-[9px] text-surface-400">revenue {fmtK(p.income)}</p>
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Highest Expense callout */}
                            {topExpense && topExpense.expense > 0 && (
                                <>
                                    <div className="border-t border-surface-100 my-2.5"></div>
                                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-red-50/50 border border-red-100">
                                        <span className="text-lg">💸</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Highest Expense</p>
                                            <p className="text-sm font-semibold text-surface-800 truncate">{topExpense.project_code}</p>
                                        </div>
                                        <p className="text-sm font-bold text-red-500">{fmtK(topExpense.expense)}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-52">
                            <div className="text-center">
                                <div className="w-14 h-14 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-2"><FolderIcon className="w-7 h-7 text-surface-200" /></div>
                                <p className="text-xs text-surface-300">No project data</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ RECENT ACTIVITY ═══ */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <EyeIcon className="w-5 h-5 text-brand-500" />
                        <h3 className="text-sm font-bold text-surface-900">Recent Activity</h3>
                    </div>
                    <button onClick={() => navigate('/documents')} className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                        View all →
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(data?.recent_activity || []).map((act, i) => {
                        const stColors = { PAID: 'bg-emerald-500', OVERDUE: 'bg-red-500', PENDING: 'bg-amber-500', APPROVED: 'bg-blue-500', DRAFT: 'bg-surface-400' };
                        return (
                            <button key={act.id} onClick={() => navigate(`/documents/${act.id}/edit`)}
                                className="flex items-center gap-3 p-3 rounded-xl border border-transparent
                                hover:border-surface-200 hover:bg-surface-50/50 transition-all duration-200 text-left group"
                                style={{ animationDelay: `${i * 30}ms` }}>
                                <div className="w-9 h-9 bg-gradient-to-br from-brand-50 to-accent-50 rounded-lg flex items-center justify-center flex-shrink-0
                                    group-hover:scale-110 transition-transform">
                                    <DocumentPlusIcon className="w-4 h-4 text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-surface-800 truncate">{act.doc_number}</p>
                                    <p className="text-[10px] text-surface-400 truncate">{act.project_name || act.doc_type}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-surface-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtK(parseFloat(act.net_total || 0))}</p>
                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${stColors[act.status] || 'bg-surface-300'}`}></span>
                                        <span className="text-[9px] text-surface-400 font-medium">{act.status}</span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    {(!data?.recent_activity || data.recent_activity.length === 0) && (
                        <div className="col-span-full text-center py-12">
                            <div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <DocumentPlusIcon className="w-8 h-8 text-surface-200" />
                            </div>
                            <p className="text-sm text-surface-300 mb-3">No recent activity</p>
                            <button onClick={() => navigate('/documents/new?type=INVOICE')} className="btn-primary text-xs">
                                Create first document
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
