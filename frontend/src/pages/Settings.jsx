import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Settings() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VIEWER' });

    if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (err) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editUser) {
                await api.put(`/users/${editUser.id}`, form);
                toast.success('User updated');
            } else {
                await api.post('/users', form);
                toast.success('User created');
            }
            setShowModal(false);
            setEditUser(null);
            setForm({ name: '', email: '', password: '', role: 'VIEWER' });
            loadUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save user');
        }
    };

    const handleEdit = (u) => {
        setEditUser(u);
        setForm({ name: u.name, email: u.email, password: '', role: u.role });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this user?')) return;
        try {
            await api.delete(`/users/${id}`);
            toast.success('User deleted');
            loadUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete');
        }
    };

    const roleColors = { ADMIN: 'badge-purple', EDITOR: 'badge-blue', VIEWER: 'badge-gray' };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900">Settings</h1>
                    <p className="text-sm text-surface-500">จัดการผู้ใช้งานและสิทธิ์การเข้าถึง</p>
                </div>
                <button onClick={() => { setEditUser(null); setForm({ name: '', email: '', password: '', role: 'VIEWER' }); setShowModal(true); }} className="btn-primary">
                    <PlusIcon className="w-4 h-4" /> Add User
                </button>
            </div>

            <div className="card">
                <div className="table-container">
                    <table>
                        <thead><tr>
                            <th>Name</th><th>Email</th><th>Role</th><th>Projects</th><th>Created</th><th>Actions</th>
                        </tr></thead>
                        <tbody>
                            {loading ? (
                                [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6}><div className="h-4 bg-surface-200 rounded animate-pulse"></div></td></tr>)
                            ) : users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-accent-500 rounded-lg flex items-center justify-center">
                                                <span className="text-white text-xs font-bold">{u.name?.charAt(0)}</span>
                                            </div>
                                            <span className="font-medium text-surface-900">{u.name}</span>
                                        </div>
                                    </td>
                                    <td className="text-surface-500">{u.email}</td>
                                    <td><span className={roleColors[u.role] || 'badge-gray'}>{u.role}</span></td>
                                    <td className="text-surface-500 text-xs">{u.projects?.filter(Boolean).join(', ') || '-'}</td>
                                    <td className="text-surface-400 text-xs">{new Date(u.created_at).toLocaleDateString('th-TH')}</td>
                                    <td>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEdit(u)} className="btn-ghost text-xs px-2 py-1"><PencilIcon className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDelete(u.id)} className="btn-ghost text-xs px-2 py-1 text-red-600 hover:bg-red-50"><TrashIcon className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md animate-scale-in">
                        <div className="p-6 border-b border-surface-100">
                            <h2 className="text-lg font-bold text-surface-900">{editUser ? 'Edit User' : 'Add User'}</h2>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
                            <div><label className="label">Password {editUser && '(leave blank to keep)'}</label><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} {...(!editUser ? { required: true } : {})} /></div>
                            <div>
                                <label className="label">Role</label>
                                <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                                    <option value="ADMIN">Admin</option>
                                    <option value="EDITOR">Editor</option>
                                    <option value="VIEWER">Viewer</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary">{editUser ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
