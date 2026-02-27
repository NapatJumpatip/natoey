import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    HomeIcon, FolderIcon, DocumentTextIcon, ShoppingCartIcon,
    BanknotesIcon, CalculatorIcon, ChartBarIcon, Cog6ToothIcon,
    QuestionMarkCircleIcon, ChevronDownIcon, ChevronLeftIcon,
    Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const menuItems = [
    { name: 'Dashboard', path: '/', icon: HomeIcon },
    { name: 'Projects', path: '/projects', icon: FolderIcon },
    {
        name: 'Documents', icon: DocumentTextIcon, children: [
            { name: 'Quotation', path: '/documents?type=QUOTATION' },
            { name: 'Invoice', path: '/documents?type=INVOICE' },
            { name: 'Tax Invoice', path: '/documents?type=TAX_INVOICE' },
            { name: 'Receipt', path: '/documents?type=RECEIPT' },
        ]
    },
    {
        name: 'Purchases', icon: ShoppingCartIcon, children: [
            { name: 'Purchase Order', path: '/documents?type=PO' },
            { name: 'Vendor Payment', path: '/documents?type=VENDOR_PAYMENT' },
        ]
    },
    {
        name: 'Payroll & Advances', icon: BanknotesIcon, children: [
            { name: 'Employee Advance', path: '/documents?type=ADVANCE' },
            { name: 'Advance Clearance', path: '/documents?type=CLEARANCE' },
        ]
    },
    {
        name: 'Taxes & Forms', icon: CalculatorIcon, children: [
            { name: 'VAT Sales', path: '/tax/vat-sales' },
            { name: 'VAT Purchase', path: '/tax/vat-purchase' },
            { name: 'ภงด.3', path: '/tax/pnd3' },
            { name: 'ภงด.53', path: '/tax/pnd53' },
            { name: '50 ทวิ', path: '/tax/50bis' },
        ]
    },
    { name: 'Reports', path: '/reports', icon: ChartBarIcon },
    { name: 'Settings', path: '/settings', icon: Cog6ToothIcon, adminOnly: true },
    { name: 'Help', path: '/help', icon: QuestionMarkCircleIcon },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
    const [openMenus, setOpenMenus] = useState({});
    const location = useLocation();
    const { user } = useAuth();

    const toggleMenu = (name) => {
        setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname + location.search === path || location.pathname.startsWith(path.split('?')[0]);
    };

    const filteredItems = menuItems.filter(item => {
        if (item.adminOnly && user?.role !== 'ADMIN') return false;
        return true;
    });

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-200/60">
                <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/25">
                    <span className="text-white font-bold text-sm">NC</span>
                </div>
                {!collapsed && (
                    <div className="animate-fade-in">
                        <h1 className="font-bold text-surface-900 text-sm leading-tight">NCON2559</h1>
                        <p className="text-[10px] text-surface-400 font-medium">CONSTRUCTION</p>
                    </div>
                )}
                <button
                    onClick={onToggle}
                    className="ml-auto p-1.5 rounded-lg hover:bg-surface-100 transition-colors hidden lg:flex"
                >
                    <ChevronLeftIcon className={`w-4 h-4 text-surface-400 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {filteredItems.map((item) => {
                    if (item.children) {
                        const isOpen = openMenus[item.name];
                        const hasActiveChild = item.children.some(c => isActive(c.path));
                        return (
                            <div key={item.name}>
                                <button
                                    onClick={() => toggleMenu(item.name)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${hasActiveChild ? 'text-brand-700 bg-brand-50' : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}`}
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && (
                                        <>
                                            <span className="flex-1 text-left">{item.name}</span>
                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                        </>
                                    )}
                                </button>
                                {!collapsed && isOpen && (
                                    <div className="ml-8 mt-0.5 space-y-0.5 animate-slide-up">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.path}
                                                to={child.path}
                                                onClick={onMobileClose}
                                                className={`block px-3 py-2 rounded-lg text-sm transition-all duration-200
                          ${isActive(child.path) ? 'text-brand-700 bg-brand-50 font-medium' : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'}`}
                                            >
                                                {child.name}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={onMobileClose}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive(item.path) ? 'text-brand-700 bg-brand-50 shadow-sm' : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'}`}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            {/* User info footer */}
            {!collapsed && user && (
                <div className="px-4 py-3 border-t border-surface-200/60">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-accent-500 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{user.name?.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">{user.name}</p>
                            <p className="text-xs text-surface-400">{user.role}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onMobileClose} />
            )}

            {/* Mobile sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-surface-200/60 transform transition-transform duration-300 lg:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {sidebarContent}
            </aside>

            {/* Desktop sidebar */}
            <aside className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-surface-200/60 transition-all duration-300 z-30
        ${collapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}>
                {sidebarContent}
            </aside>
        </>
    );
}
