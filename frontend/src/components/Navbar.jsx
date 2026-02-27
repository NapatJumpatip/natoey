import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bars3Icon, MagnifyingGlassIcon, BellIcon, UserCircleIcon,
    ArrowRightOnRectangleIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

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
                    <button className="relative p-2 rounded-xl hover:bg-surface-100 transition-colors">
                        <BellIcon className="w-5 h-5 text-surface-500" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                    </button>

                    {/* User Menu */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
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
