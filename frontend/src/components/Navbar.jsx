import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bars3Icon, MagnifyingGlassIcon, BellIcon, UserCircleIcon,
    ArrowRightOnRectangleIcon, Cog6ToothIcon,
    ExclamationTriangleIcon, DocumentTextIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const formatCurrency = (v) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(v || 0);

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const menuRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadNotifications = async () => {
        if (notifLoading) return;
        setNotifLoading(true);
        try {
            const { data } = await api.get('/reports/summary');
            const notifs = [];

            // Overdue documents
            if (data.overdue_count > 0) {
                notifs.push({
                    id: 'overdue',
                    type: 'warning',
                    icon: ExclamationTriangleIcon,
                    title: `${data.overdue_count} overdue documents`,
                    desc: 'เอกสารเกินกำหนดชำระ',
                    action: '/documents?status=OVERDUE',
                    color: 'text-red-500',
                    bg: 'bg-red-50',
                });
            }

            // Outstanding Receivables
            if (data.outstanding_receivables > 0) {
                notifs.push({
                    id: 'receivables',
                    type: 'info',
                    icon: DocumentTextIcon,
                    title: `Receivables: ${formatCurrency(data.outstanding_receivables)}`,
                    desc: 'ลูกหนี้การค้าค้างชำระ',
                    action: '/documents?type=INVOICE',
                    color: 'text-blue-500',
                    bg: 'bg-blue-50',
                });
            }

            // Outstanding Payables
            if (data.outstanding_payables > 0) {
                notifs.push({
                    id: 'payables',
                    type: 'info',
                    icon: DocumentTextIcon,
                    title: `Payables: ${formatCurrency(data.outstanding_payables)}`,
                    desc: 'เจ้าหนี้การค้าค้างชำระ',
                    action: '/documents?type=PO',
                    color: 'text-amber-500',
                    bg: 'bg-amber-50',
                });
            }

            // Recent activity
            (data.recent_activity || []).slice(0, 5).forEach((act) => {
                notifs.push({
                    id: `act-${act.id}`,
                    type: 'activity',
                    icon: ClockIcon,
                    title: `${act.doc_number} — ${formatCurrency(act.net_total)}`,
                    desc: act.project_name || act.doc_type,
                    action: `/documents/${act.id}/edit`,
                    color: 'text-surface-500',
                    bg: 'bg-surface-50',
                    time: new Date(act.created_at).toLocaleDateString('th-TH'),
                });
            });

            setNotifications(notifs);
        } catch (err) {
            console.error('Failed to load notifications');
        } finally {
            setNotifLoading(false);
        }
    };

    const handleBellClick = () => {
        const opening = !showNotifications;
        setShowNotifications(opening);
        setShowUserMenu(false);
        if (opening) loadNotifications();
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const overdueCount = notifications.filter(n => n.type === 'warning').reduce((sum, n) => {
        const match = n.title.match(/^(\d+)/);
        return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    return (
        <header className="sticky top-0 z-20 glass border-b border-surface-200/60">
            <div className="flex items-center justify-between h-16 px-4 lg:px-6">
                {/* Left: Mobile menu + Brand */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onMenuClick}
                        className="p-2 rounded-xl hover:bg-surface-100 transition-colors lg:hidden"
                    >
                        <Bars3Icon className="w-5 h-5 text-surface-600" />
                    </button>
                    <h2 className="text-lg font-semibold text-surface-900 hidden sm:block">
                        NCON2559 <span className="text-surface-400 font-normal text-sm">Construction Accounting</span>
                    </h2>
                </div>

                {/* Center: Search */}
                <div className="flex-1 max-w-md mx-4 hidden md:block">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาเอกสาร, โครงการ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-surface-100 border-0 rounded-xl text-sm
                placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white
                transition-all duration-200"
                        />
                    </div>
                </div>

                {/* Right: Notifications + User */}
                <div className="flex items-center gap-2">
                    {/* Notification Bell */}
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={handleBellClick}
                            className={`relative p-2 rounded-xl transition-colors ${showNotifications ? 'bg-brand-50 text-brand-600' : 'hover:bg-surface-100 text-surface-500'}`}
                        >
                            <BellIcon className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-surface-200 animate-scale-in overflow-hidden">
                                <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-900">Notifications</h3>
                                    <span className="text-[10px] font-medium text-surface-400">{notifications.length} items</span>
                                </div>
                                <div className="max-h-[380px] overflow-y-auto">
                                    {notifLoading ? (
                                        <div className="p-6 text-center">
                                            <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto"></div>
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-surface-400">
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.map((notif) => (
                                            <button
                                                key={notif.id}
                                                onClick={() => { navigate(notif.action); setShowNotifications(false); }}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-50 transition-colors text-left border-b border-surface-50 last:border-0"
                                            >
                                                <div className={`p-1.5 rounded-lg ${notif.bg} mt-0.5 flex-shrink-0`}>
                                                    <notif.icon className={`w-4 h-4 ${notif.color}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-surface-800 truncate">{notif.title}</p>
                                                    <p className="text-xs text-surface-400 truncate">{notif.desc}</p>
                                                </div>
                                                {notif.time && (
                                                    <span className="text-[10px] text-surface-400 flex-shrink-0 mt-1">{notif.time}</span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                                <div className="px-4 py-2.5 border-t border-surface-100 bg-surface-50/50">
                                    <button
                                        onClick={() => { navigate('/'); setShowNotifications(false); }}
                                        className="w-full text-center text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                                    >
                                        View Dashboard →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-surface-100 transition-colors"
                        >
                            <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-accent-500 rounded-lg flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{user?.name?.charAt(0) || 'U'}</span>
                            </div>
                            <span className="text-sm font-medium text-surface-700 hidden sm:block">{user?.name}</span>
                        </button>

                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-surface-200 py-1 animate-scale-in">
                                <div className="px-4 py-3 border-b border-surface-100">
                                    <p className="text-sm font-semibold text-surface-900">{user?.name}</p>
                                    <p className="text-xs text-surface-400">{user?.email}</p>
                                    <span className="badge-blue mt-1">{user?.role}</span>
                                </div>
                                <button
                                    onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-surface-600 hover:bg-surface-50 transition-colors"
                                >
                                    <Cog6ToothIcon className="w-4 h-4" /> Settings
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <ArrowRightOnRectangleIcon className="w-4 h-4" /> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
