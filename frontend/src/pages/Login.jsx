import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    if (user) return <Navigate to="/" replace />;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left: Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-400 rounded-full blur-3xl"></div>
                </div>
                <div className="relative z-10 flex flex-col justify-center px-16">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 ring-1 ring-white/20">
                        <span className="text-white font-bold text-2xl">NC</span>
                    </div>
                    <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                        NCON2559
                    </h1>
                    <p className="text-xl text-brand-100 mb-2">Construction Accounting System</p>
                    <p className="text-brand-200/80 text-sm leading-relaxed max-w-md">
                        ระบบบัญชีก่อสร้างครบวงจร จัดการโครงการ เอกสาร ภาษี และรายงานทางการเงินในที่เดียว
                    </p>
                    <div className="mt-12 grid grid-cols-3 gap-4">
                        {[
                            { label: 'Projects', value: 'Unlimited' },
                            { label: 'Documents', value: 'All Types' },
                            { label: 'Reports', value: 'PDF & Excel' },
                        ].map((item) => (
                            <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 ring-1 ring-white/10">
                                <p className="text-white font-semibold text-lg">{item.value}</p>
                                <p className="text-brand-200 text-xs">{item.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right: Login Form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 bg-surface-50">
                <div className="w-full max-w-md">
                    <div className="lg:hidden mb-8 text-center">
                        <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/25">
                            <span className="text-white font-bold text-xl">NC</span>
                        </div>
                        <h1 className="text-2xl font-bold text-surface-900">NCON2559</h1>
                        <p className="text-surface-500 text-sm">Construction Accounting System</p>
                    </div>

                    <div className="card p-8">
                        <h2 className="text-2xl font-bold text-surface-900 mb-1">เข้าสู่ระบบ</h2>
                        <p className="text-surface-500 text-sm mb-8">Sign in to your account</p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="label">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@ncon2559.com"
                                    className="input"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="label">Password</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••"
                                        className="input pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                                    >
                                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full py-3"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Signing in...
                                    </span>
                                ) : 'Sign in'}
                            </button>
                        </form>

                        <div className="mt-6 p-4 bg-surface-50 rounded-xl">
                            <p className="text-xs font-medium text-surface-500 mb-2">Demo Accounts:</p>
                            <div className="space-y-1 text-xs text-surface-600">
                                <p><span className="font-medium">Admin:</span> admin@ncon2559.com / 123456</p>
                                <p><span className="font-medium">Editor:</span> editor@ncon2559.com / 123456</p>
                                <p><span className="font-medium">Viewer:</span> viewer@ncon2559.com / 123456</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
