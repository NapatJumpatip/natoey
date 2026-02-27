import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(v || 0);

const pageConfig = {
    'vat-sales': { title: 'VAT Sales Report', subtitle: 'รายงานภาษีขาย', endpoint: '/reports/vat-sales', exportType: 'vat-sales' },
    'vat-purchase': { title: 'VAT Purchase Report', subtitle: 'รายงานภาษีซื้อ', endpoint: '/reports/vat-purchase', exportType: 'vat-purchase' },
    'pnd3': { title: 'ภงด.3', subtitle: 'แบบแสดงรายการภาษีหัก ณ ที่จ่าย (บุคคลธรรมดา)', endpoint: '/reports/wht', exportType: 'wht' },
    'pnd53': { title: 'ภงด.53', subtitle: 'แบบแสดงรายการภาษีหัก ณ ที่จ่าย (นิติบุคคล)', endpoint: '/reports/wht', exportType: 'wht' },
    '50bis': { title: '50 ทวิ', subtitle: 'หนังสือรับรองการหักภาษี ณ ที่จ่าย', endpoint: '/reports/wht', exportType: 'wht' },
};

export default function TaxForms() {
    const { type } = useParams();
    const config = pageConfig[type] || pageConfig['vat-sales'];
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        loadData();
    }, [type, period]);

    const loadData = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (period) params.set('period', period);
            if (type === 'pnd3') params.set('type', 'PND3');
            if (type === 'pnd53') params.set('type', 'PND53');
            if (type === '50bis') params.set('type', '50BIS');
            const { data: result } = await api.get(`${config.endpoint}?${params.toString()}`);
            setData(result);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = (format) => {
        window.open(`/api/reports/export?format=${format}&type=${config.exportType}&period=${period}`, '_blank');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">{config.title}</h1>
                    <p className="text-sm text-surface-500">{config.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="input max-w-[180px]" />
                    <button onClick={() => handleExport('excel')} className="btn-secondary">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={() => handleExport('pdf')} className="btn-primary">
                        <ArrowDownTrayIcon className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="kpi-card">
                        <p className="text-xs font-medium text-surface-500 uppercase">Total Subtotal</p>
                        <p className="text-xl font-bold text-surface-900 mt-1">{formatCurrency(data.total_subtotal || 0)}</p>
                    </div>
                    <div className="kpi-card">
                        <p className="text-xs font-medium text-surface-500 uppercase">{type?.startsWith('pnd') || type === '50bis' ? 'Total WHT' : 'Total VAT'}</p>
                        <p className="text-xl font-bold text-brand-700 mt-1">{formatCurrency(data.total_vat || data.total_wht || 0)}</p>
                    </div>
                    <div className="kpi-card">
                        <p className="text-xs font-medium text-surface-500 uppercase">Documents</p>
                        <p className="text-xl font-bold text-surface-900 mt-1">{data.documents?.length || 0}</p>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Doc Number</th>
                                <th>Date</th>
                                <th>Project</th>
                                {(type?.startsWith('pnd') || type === '50bis') ? (
                                    <>
                                        <th>Vendor</th>
                                        <th>Tax ID</th>
                                        <th>Subtotal</th>
                                        <th>WHT</th>
                                    </>
                                ) : (
                                    <>
                                        <th>Subtotal</th>
                                        <th>VAT</th>
                                        <th>Net Total</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8}><div className="h-4 bg-surface-200 rounded animate-pulse"></div></td></tr>)
                            ) : (data?.documents || []).length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-8 text-surface-400">No data for this period</td></tr>
                            ) : (data?.documents || []).map((doc, i) => (
                                <tr key={doc.id}>
                                    <td className="text-surface-400">{i + 1}</td>
                                    <td className="font-mono text-xs">{doc.doc_number}</td>
                                    <td className="text-surface-500">{new Date(doc.created_at).toLocaleDateString('th-TH')}</td>
                                    <td className="text-surface-600">{doc.project_name || '-'}</td>
                                    {(type?.startsWith('pnd') || type === '50bis') ? (
                                        <>
                                            <td>{doc.vendor_name || '-'}</td>
                                            <td className="font-mono text-xs">{doc.vendor_tax_id || '-'}</td>
                                            <td className="font-medium">{formatCurrency(doc.subtotal)}</td>
                                            <td className="font-semibold text-red-600">{formatCurrency(doc.wht_amount)}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="font-medium">{formatCurrency(doc.subtotal)}</td>
                                            <td className="text-brand-600 font-medium">{formatCurrency(doc.vat_amount)}</td>
                                            <td className="font-semibold">{formatCurrency(doc.net_total)}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
