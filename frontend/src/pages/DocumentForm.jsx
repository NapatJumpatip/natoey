import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(v || 0);

export default function DocumentForm() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        doc_type: searchParams.get('type') || 'INVOICE',
        project_id: searchParams.get('project') || '',
        vat_rate: 0.07,
        wht_rate: 0,
        due_date: '',
        status: 'DRAFT',
        notes: '',
        vendor_name: '',
        vendor_tax_id: '',
    });
    const [lineItems, setLineItems] = useState([
        { description: '', quantity: 1, unit: 'unit', unit_price: 0 }
    ]);

    useEffect(() => {
        api.get('/projects').then(r => setProjects(r.data)).catch(() => { });
        if (isEdit) {
            api.get(`/documents/${id}`).then(r => {
                const doc = r.data;
                setForm({
                    doc_type: doc.doc_type,
                    project_id: doc.project_id,
                    vat_rate: parseFloat(doc.vat_rate),
                    wht_rate: parseFloat(doc.wht_rate),
                    due_date: doc.due_date || '',
                    status: doc.status,
                    notes: doc.notes || '',
                    vendor_name: doc.vendor_name || '',
                    vendor_tax_id: doc.vendor_tax_id || '',
                });
                if (doc.line_items?.length) {
                    setLineItems(doc.line_items.map(li => ({
                        description: li.description,
                        quantity: parseFloat(li.quantity),
                        unit: li.unit || 'unit',
                        unit_price: parseFloat(li.unit_price),
                    })));
                }
            }).catch(() => toast.error('Failed to load document'));
        }
    }, [id]);

    const subtotal = lineItems.reduce((sum, li) => sum + (li.quantity * li.unit_price), 0);
    const vatAmount = subtotal * form.vat_rate;
    const whtAmount = subtotal * form.wht_rate;
    const incomeTypes = ['QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT'];
    const netTotal = incomeTypes.includes(form.doc_type) ? subtotal + vatAmount - whtAmount : subtotal + vatAmount;

    const addLine = () => setLineItems([...lineItems, { description: '', quantity: 1, unit: 'unit', unit_price: 0 }]);
    const removeLine = (i) => setLineItems(lineItems.filter((_, idx) => idx !== i));
    const updateLine = (i, field, value) => {
        const updated = [...lineItems];
        updated[i] = { ...updated[i], [field]: field === 'description' || field === 'unit' ? value : parseFloat(value) || 0 };
        setLineItems(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.project_id) { toast.error('Please select a project'); return; }
        if (lineItems.length === 0 || lineItems.some(li => !li.description)) { toast.error('Please fill all line items'); return; }

        setLoading(true);
        try {
            const payload = { ...form, line_items: lineItems };
            if (isEdit) {
                await api.put(`/documents/${id}`, payload);
                toast.success('Document updated');
            } else {
                await api.post('/documents', payload);
                toast.success('Document created');
            }
            navigate('/documents' + (form.doc_type ? `?type=${form.doc_type}` : ''));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save document');
        } finally {
            setLoading(false);
        }
    };

    const docTypes = [
        { value: 'QUOTATION', label: 'Quotation' }, { value: 'INVOICE', label: 'Invoice' },
        { value: 'TAX_INVOICE', label: 'Tax Invoice' }, { value: 'RECEIPT', label: 'Receipt' },
        { value: 'PO', label: 'Purchase Order' }, { value: 'VENDOR_PAYMENT', label: 'Vendor Payment' },
        { value: 'ADVANCE', label: 'Employee Advance' }, { value: 'CLEARANCE', label: 'Advance Clearance' },
    ];

    const showVendor = ['PO', 'VENDOR_PAYMENT'].includes(form.doc_type);
    const showWht = ['INVOICE', 'TAX_INVOICE', 'RECEIPT', 'VENDOR_PAYMENT'].includes(form.doc_type);

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-900">{isEdit ? 'Edit Document' : 'New Document'}</h1>
                <p className="text-sm text-surface-500">Fill in the details below</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="card p-6">
                    <h3 className="font-semibold text-surface-900 mb-4">Document Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Document Type</label>
                            <select className="select" value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} disabled={isEdit}>
                                {docTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Project</label>
                            <select className="select" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} required>
                                <option value="">Select project...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.project_code} - {p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label">Due Date</label>
                            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                        </div>
                    </div>
                    {isEdit && (
                        <div className="mt-4">
                            <label className="label">Status</label>
                            <select className="select max-w-xs" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                {['DRAFT', 'PENDING', 'APPROVED', 'PAID', 'OVERDUE', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Vendor Info */}
                {showVendor && (
                    <div className="card p-6">
                        <h3 className="font-semibold text-surface-900 mb-4">Vendor Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="label">Vendor Name</label><input className="input" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></div>
                            <div><label className="label">Vendor Tax ID</label><input className="input" value={form.vendor_tax_id} onChange={(e) => setForm({ ...form, vendor_tax_id: e.target.value })} /></div>
                        </div>
                    </div>
                )}

                {/* Line Items */}
                <div className="card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-surface-900">Line Items</h3>
                        <button type="button" onClick={addLine} className="btn-secondary text-xs">
                            <PlusIcon className="w-3.5 h-3.5" /> Add Item
                        </button>
                    </div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-surface-500 uppercase px-1">
                            <div className="col-span-5">Description</div>
                            <div className="col-span-1">Qty</div>
                            <div className="col-span-1">Unit</div>
                            <div className="col-span-2">Unit Price</div>
                            <div className="col-span-2">Total</div>
                            <div className="col-span-1"></div>
                        </div>
                        {lineItems.map((li, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                <input className="input col-span-5 text-sm" placeholder="Description" value={li.description} onChange={(e) => updateLine(i, 'description', e.target.value)} />
                                <input type="number" className="input col-span-1 text-sm text-center" value={li.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} min="0" step="0.01" />
                                <input className="input col-span-1 text-sm text-center" value={li.unit} onChange={(e) => updateLine(i, 'unit', e.target.value)} />
                                <input type="number" className="input col-span-2 text-sm text-right" value={li.unit_price} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} min="0" step="0.01" />
                                <div className="col-span-2 text-sm font-medium text-surface-700 text-right pr-2">{formatCurrency(li.quantity * li.unit_price)}</div>
                                <button type="button" onClick={() => removeLine(i)} className="col-span-1 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tax & Totals */}
                <div className="card p-6">
                    <h3 className="font-semibold text-surface-900 mb-4">Tax & Totals</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="label">VAT Rate (%)</label>
                                <input type="number" className="input" value={(form.vat_rate * 100).toFixed(0)} onChange={(e) => setForm({ ...form, vat_rate: parseFloat(e.target.value) / 100 || 0 })} step="1" />
                            </div>
                            {showWht && (
                                <div>
                                    <label className="label">WHT Rate (%)</label>
                                    <input type="number" className="input" value={(form.wht_rate * 100).toFixed(0)} onChange={(e) => setForm({ ...form, wht_rate: parseFloat(e.target.value) / 100 || 0 })} step="1" />
                                </div>
                            )}
                            <div>
                                <label className="label">Notes</label>
                                <textarea className="input min-h-[80px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                            </div>
                        </div>
                        <div className="bg-surface-50 rounded-xl p-5 space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-surface-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-surface-500">VAT ({(form.vat_rate * 100).toFixed(0)}%)</span><span className="font-medium">{formatCurrency(vatAmount)}</span></div>
                            {showWht && <div className="flex justify-between text-sm"><span className="text-surface-500">WHT ({(form.wht_rate * 100).toFixed(0)}%)</span><span className="font-medium text-red-600">-{formatCurrency(whtAmount)}</span></div>}
                            <div className="flex justify-between text-lg font-bold pt-3 border-t border-surface-200">
                                <span>Net Total</span>
                                <span className="text-brand-700">{formatCurrency(netTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={loading} className="btn-primary">
                        {loading ? 'Saving...' : isEdit ? 'Update Document' : 'Create Document'}
                    </button>
                </div>
            </form>
        </div>
    );
}
