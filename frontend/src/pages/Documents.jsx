import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusIcon, FunnelIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);
const statusColors = { PAID: 'badge-green', OVERDUE: 'badge-red', PENDING: 'badge-yellow', APPROVED: 'badge-blue', DRAFT: 'badge-gray', CANCELLED: 'badge-gray' };
const typeLabels = { QUOTATION: 'Quotation', INVOICE: 'Invoice', TAX_INVOICE: 'Tax Invoice', RECEIPT: 'Receipt', PO: 'Purchase Order', VENDOR_PAYMENT: 'Vendor Payment', ADVANCE: 'Employee Advance', CLEARANCE: 'Advance Clearance' };

export default function Documents() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const typeFilter = searchParams.get('type') || '';
    const statusFilter = searchParams.get('status') || '';
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    useEffect(() => {
        loadDocuments();
    }, [typeFilter, statusFilter, page]);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (typeFilter) params.set('type', typeFilter);
            if (statusFilter) params.set('status', statusFilter);
            params.set('page', page);
            params.set('limit', 20);
            const { data } = await api.get(`/documents?${params.toString()}`);
            setDocuments(data.documents);
            setPagination(data.pagination);
        } catch (err) {
            toast.error('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this document?')) return;
        try {
            await api.delete(`/documents/${id}`);
            toast.success('Document deleted');
            loadDocuments();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const title = typeFilter ? typeLabels[typeFilter] || typeFilter : 'All Documents';

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">{title}</h1>
                    <p className="text-sm text-surface-500">{pagination.total || 0} documents</p>
                </div>
                {(user?.role === 'ADMIN' || user?.role === 'EDITOR') && (
                    <button onClick={() => navigate(`/documents/new${typeFilter ? `?type=${typeFilter}` : ''}`)} className="btn-primary">
                        <PlusIcon className="w-4 h-4" /> New {typeLabels[typeFilter] || 'Document'}
                    </button>
                )}
            </div>

            {/* Type Filter Chips */}
            {!typeFilter && (
                <div className="flex flex-wrap gap-2">
                    {Object.entries(typeLabels).map(([key, label]) => (
                        <button key={key} onClick={() => navigate(`/documents?type=${key}`)}
                            className="px-3 py-1.5 text-xs font-medium rounded-full bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-700 transition-colors">
                            {label}
                        </button>
                    ))}
                </div>
            )}

            {/* Table */}
            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Doc Number</th>
                                <th>Type</th>
                                <th>Project</th>
                                <th>Subtotal</th>
                                <th>VAT</th>
                                <th>Net Total</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i}><td colSpan={9}><div className="h-4 bg-surface-200 rounded animate-pulse"></div></td></tr>
                                ))
                            ) : documents.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-8 text-surface-400">No documents found</td></tr>
                            ) : documents.map((doc) => (
                                <tr key={doc.id}>
                                    <td>
                                        <button onClick={() => navigate(`/documents/${doc.id}/edit`)} className="font-mono text-xs text-brand-600 hover:underline">
                                            {doc.doc_number}
                                        </button>
                                    </td>
                                    <td><span className="badge-blue text-[10px]">{doc.doc_type}</span></td>
                                    <td className="text-surface-600 max-w-[150px] truncate">{doc.project_name || '-'}</td>
                                    <td className="font-medium">{formatCurrency(doc.subtotal)}</td>
                                    <td className="text-surface-500">{formatCurrency(doc.vat_amount)}</td>
                                    <td className="font-semibold">{formatCurrency(doc.net_total)}</td>
                                    <td><span className={statusColors[doc.status] || 'badge-gray'}>{doc.status}</span></td>
                                    <td className={`text-sm ${doc.status === 'OVERDUE' ? 'text-red-600 font-semibold' : 'text-surface-500'}`}>
                                        {doc.due_date || '-'}
                                    </td>
                                    <td>
                                        <div className="flex gap-1">
                                            <button onClick={() => navigate(`/documents/${doc.id}/edit`)} className="btn-ghost text-xs px-2 py-1">Edit</button>
                                            {user?.role === 'ADMIN' && (
                                                <button onClick={() => handleDelete(doc.id)} className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50">Delete</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
                        <p className="text-xs text-surface-500">Page {pagination.page} of {pagination.pages}</p>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs">Previous</button>
                            <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs">Next</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
