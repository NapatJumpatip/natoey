import { ArrowDownTrayIcon, DocumentTextIcon, TableCellsIcon } from '@heroicons/react/24/outline';

const exportCards = [
    { title: 'Invoice PDF', desc: 'Export invoices in PDF format', format: 'pdf', type: 'vat-sales', icon: DocumentTextIcon, color: 'from-red-500 to-red-600' },
    { title: 'Tax Invoice PDF', desc: 'Tax invoice documents', format: 'pdf', type: 'vat-sales', icon: DocumentTextIcon, color: 'from-orange-500 to-orange-600' },
    { title: '50 ทวิ PDF', desc: 'Withholding tax certificates', format: 'pdf', type: 'wht', icon: DocumentTextIcon, color: 'from-purple-500 to-purple-600' },
    { title: 'VAT Sales Excel', desc: 'Sales tax report spreadsheet', format: 'excel', type: 'vat-sales', icon: TableCellsIcon, color: 'from-emerald-500 to-emerald-600' },
    { title: 'VAT Purchase Excel', desc: 'Purchase tax report spreadsheet', format: 'excel', type: 'vat-purchase', icon: TableCellsIcon, color: 'from-teal-500 to-teal-600' },
    { title: 'Income vs Expense', desc: 'Full income/expense report', format: 'excel', type: 'income-expense', icon: TableCellsIcon, color: 'from-blue-500 to-blue-600' },
];

export default function Reports() {
    const handleExport = (format, type) => {
        window.open(`/api/reports/export?format=${format}&type=${type}`, '_blank');
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-surface-900">Reports</h1>
                <p className="text-sm text-surface-500">ส่งออกรายงานในรูปแบบ PDF และ Excel</p>
            </div>

            {/* PDF Reports */}
            <div>
                <h2 className="text-lg font-semibold text-surface-800 mb-3">PDF Reports</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {exportCards.filter(c => c.format === 'pdf').map((card, i) => (
                        <div key={i} className="card p-5 group cursor-pointer hover:border-brand-300 transition-all"
                            onClick={() => handleExport(card.format, card.type)}>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                <card.icon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-semibold text-surface-900">{card.title}</h3>
                            <p className="text-sm text-surface-500 mt-1">{card.desc}</p>
                            <div className="mt-3 flex items-center gap-1 text-brand-600 text-sm font-medium">
                                <ArrowDownTrayIcon className="w-4 h-4" /> Download
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Excel Reports */}
            <div>
                <h2 className="text-lg font-semibold text-surface-800 mb-3">Excel Reports</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {exportCards.filter(c => c.format === 'excel').map((card, i) => (
                        <div key={i} className="card p-5 group cursor-pointer hover:border-brand-300 transition-all"
                            onClick={() => handleExport(card.format, card.type)}>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                <card.icon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="font-semibold text-surface-900">{card.title}</h3>
                            <p className="text-sm text-surface-500 mt-1">{card.desc}</p>
                            <div className="mt-3 flex items-center gap-1 text-brand-600 text-sm font-medium">
                                <ArrowDownTrayIcon className="w-4 h-4" /> Download
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
