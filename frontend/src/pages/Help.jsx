import { QuestionMarkCircleIcon, BookOpenIcon, ChatBubbleLeftRightIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const faqs = [
    { q: 'How to create a new document?', a: 'Navigate to Documents section from the sidebar, click "New Document", select the document type and project, fill in line items, and click Create.' },
    { q: 'How are VAT and WHT calculated?', a: 'VAT = Subtotal × VAT Rate (default 7%). WHT = Subtotal × WHT Rate (default 3%). For income documents: Net = Subtotal + VAT - WHT. For expenses: Net = Subtotal + VAT.' },
    { q: 'What are the user roles?', a: 'ADMIN: Full access to all features. EDITOR: Can create/edit documents for assigned projects. VIEWER: Read-only access to assigned projects.' },
    { q: 'How does auto-numbering work?', a: 'Documents are automatically numbered with the format PREFIX-YYYY-NNNN (e.g., INV-2025-0001). Numbering resets annually.' },
    { q: 'How to export reports?', a: 'Go to Reports page and click the desired export card, or use the export buttons on Tax Forms pages.' },
    { q: 'What is ภงด.3 vs ภงด.53?', a: 'ภงด.3 is the withholding tax form for individual persons. ภงด.53 is for juristic persons (companies). 50 ทวิ is the withholding tax certificate.' },
];

export default function Help() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/25">
                    <QuestionMarkCircleIcon className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900">Help Center</h1>
                <p className="text-surface-500 mt-1">ศูนย์ช่วยเหลือ NCON2559</p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { icon: BookOpenIcon, title: 'Documentation', desc: 'คู่มือการใช้งาน', color: 'from-blue-500 to-blue-600' },
                    { icon: ChatBubbleLeftRightIcon, title: 'Support', desc: 'ติดต่อทีมสนับสนุน', color: 'from-emerald-500 to-emerald-600' },
                    { icon: EnvelopeIcon, title: 'Contact', desc: 'support@ncon2559.com', color: 'from-purple-500 to-purple-600' },
                ].map((card, i) => (
                    <div key={i} className="card p-5 text-center group hover:border-brand-300 transition-all">
                        <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                            <card.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-surface-900">{card.title}</h3>
                        <p className="text-sm text-surface-500 mt-1">{card.desc}</p>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <div className="card p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-4">Frequently Asked Questions</h2>
                <div className="divide-y divide-surface-100">
                    {faqs.map((faq, i) => (
                        <details key={i} className="py-4 group">
                            <summary className="cursor-pointer text-sm font-medium text-surface-800 hover:text-brand-700 transition-colors list-none flex items-center justify-between">
                                {faq.q}
                                <span className="text-surface-400 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="mt-2 text-sm text-surface-600 leading-relaxed pl-0">{faq.a}</p>
                        </details>
                    ))}
                </div>
            </div>

            {/* System Info */}
            <div className="card p-6">
                <h2 className="text-lg font-bold text-surface-900 mb-4">System Information</h2>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                    <div><dt className="text-surface-400">Version</dt><dd className="font-medium text-surface-700">1.0.0</dd></div>
                    <div><dt className="text-surface-400">Frontend</dt><dd className="font-medium text-surface-700">React 18 + Vite</dd></div>
                    <div><dt className="text-surface-400">Backend</dt><dd className="font-medium text-surface-700">Node.js + Express</dd></div>
                    <div><dt className="text-surface-400">Database</dt><dd className="font-medium text-surface-700">PostgreSQL</dd></div>
                </dl>
            </div>
        </div>
    );
}
