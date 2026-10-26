import { useCallback, useEffect, useState } from 'react';
import { approveUser, createUser, deleteUser, fetchUsers, rejectUser, updateUser } from '../api';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const emptyForm = {
    email: '',
    password: '',
    full_name: '',
    role: 'user',
};

export default function UsersPage() {
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [savingUserId, setSavingUserId] = useState('');
    const [creating, setCreating] = useState(false);
    const [rejectModal, setRejectModal] = useState({ open: false, user: null, reason: 'Registration details could not be verified.' });
    const [actionLoadingId, setActionLoadingId] = useState('');

    const handleApprove = async (user) => {
        setActionLoadingId(user.id);
        try {
            const updated = await approveUser(user.id);
            setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, is_approved: true, is_rejected: false } : item)));
            toast.success(`Approved ${user.email}. User can now sign in.`);
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to approve user.');
        } finally {
            setActionLoadingId('');
        }
    };

    const handleRejectConfirm = async () => {
        if (!rejectModal.user) return;
        setActionLoadingId(rejectModal.user.id);
        try {
            await rejectUser(rejectModal.user.id, rejectModal.reason);
            setUsers((current) => current.map((item) => (item.id === rejectModal.user.id ? { ...item, is_approved: false, is_rejected: true, rejection_reason: rejectModal.reason } : item)));
            toast.info(`Rejected ${rejectModal.user.email}.`);
            setRejectModal({ open: false, user: null, reason: '' });
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to reject user.');
        } finally {
            setActionLoadingId('');
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setUsers(await fetchUsers());
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to load users.');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const setRowValue = (userId, key, value) => {
        setUsers((current) => current.map((user) => (
            user.id === userId ? { ...user, [key]: value } : user
        )));
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setCreating(true);
        try {
            const created = await createUser(form);
            setUsers((current) => [...current, created].sort((a, b) => (a.email || '').localeCompare(b.email || '')));
            setModalOpen(false);
            setForm(emptyForm);
            toast.success('User created.');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to create user.');
        } finally {
            setCreating(false);
        }
    };

    const handleSave = async (user) => {
        setSavingUserId(user.id);
        try {
            const updated = await updateUser(user.id, {
                full_name: user.full_name || null,
                role: user.role,
                is_active: user.is_active,
            });
            setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
            toast.success('User updated.');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to update user.');
            load();
        } finally {
            setSavingUserId('');
        }
    };

    const handleDelete = async (user) => {
        const confirmed = await toast.confirm(`Delete ${user.email || 'this user'}?`, {
            title: 'Confirm deletion',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;

        setSavingUserId(user.id);
        try {
            await deleteUser(user.id);
            setUsers((current) => current.filter((item) => item.id !== user.id));
            toast.success('User deleted.');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to delete user.');
        } finally {
            setSavingUserId('');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)]/60 pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        User <span className="gold-gradient-text">Management</span>
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        Manage tenant, owner, and administrator credentials and system access permissions.
                    </p>
                </div>
                <button
                    onClick={() => setModalOpen(true)}
                    className="gold-glow-btn px-5 py-2.5 text-xs font-bold self-start sm:self-auto flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New User
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl glass-card border border-[var(--color-border)] shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-dark)]/80">
                                <th className="px-5 py-3.5">Email</th>
                                <th className="px-5 py-3.5">Full Name</th>
                                <th className="px-5 py-3.5">Role</th>
                                <th className="px-5 py-3.5">Approval</th>
                                <th className="px-5 py-3.5">Active</th>
                                <th className="px-5 py-3.5">Last Sign In</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]/40">
                            {users.map((user) => (
                                <tr key={user.id} className="align-middle hover:bg-amber-500/[0.02] transition-colors">
                                    <td className="px-5 py-4 font-semibold text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center font-bold text-xs text-[var(--color-primary)]">
                                                {user.email?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <span>{user.email || 'No email'}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <input
                                            value={user.full_name || ''}
                                            onChange={(event) => setRowValue(user.id, 'full_name', event.target.value)}
                                            className="w-full max-w-[200px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-all"
                                            placeholder="Enter name..."
                                        />
                                    </td>
                                    <td className="px-5 py-4">
                                        <select
                                            value={user.role}
                                            onChange={(event) => setRowValue(user.id, 'role', event.target.value)}
                                            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-all cursor-pointer font-medium"
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="owner">Owner</option>
                                            <option value="user">Buyer / Tenant</option>
                                        </select>
                                    </td>

                                    <td className="px-5 py-4">
                                        {user.role === 'admin' ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                                Admin (Auto)
                                            </span>
                                        ) : user.is_rejected ? (
                                            <div className="space-y-1">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                                    Rejected
                                                </span>
                                                {user.rejection_reason && (
                                                    <p className="text-[10px] text-rose-300/80 max-w-[150px] truncate" title={user.rejection_reason}>
                                                        {user.rejection_reason}
                                                    </p>
                                                )}
                                            </div>
                                        ) : user.is_approved ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                ✓ Approved
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 animate-pulse">
                                                    ⏳ Pending
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-5 py-4">
                                        <select
                                            value={user.is_active ? 'active' : 'inactive'}
                                            onChange={(event) => setRowValue(user.id, 'is_active', event.target.value === 'active')}
                                            className={`rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs focus:border-[var(--color-primary)] focus:outline-none transition-all cursor-pointer font-bold ${
                                                user.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                            }`}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </td>
                                    <td className="px-5 py-4 text-xs text-[var(--color-text-muted)]">
                                        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end items-center gap-2">
                                            {user.role !== 'admin' && !user.is_approved && (
                                                <button
                                                    onClick={() => handleApprove(user)}
                                                    disabled={actionLoadingId === user.id}
                                                    className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                    title="Approve this user for login"
                                                >
                                                    {actionLoadingId === user.id ? '...' : 'Approve'}
                                                </button>
                                            )}
                                            {user.role !== 'admin' && !user.is_rejected && !user.is_approved && (
                                                <button
                                                    onClick={() => setRejectModal({ open: true, user, reason: 'Registration details could not be verified.' })}
                                                    disabled={actionLoadingId === user.id}
                                                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-50 cursor-pointer"
                                                    title="Reject registration"
                                                >
                                                    Reject
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSave(user)}
                                                disabled={savingUserId === user.id}
                                                className="rounded-xl bg-amber-500/20 hover:bg-amber-500 text-[var(--color-primary-light)] hover:text-slate-950 border border-amber-500/40 px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                disabled={savingUserId === user.id}
                                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-50"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-text-muted)]">
                                        No users registered in the system yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={modalOpen} open={modalOpen} onClose={() => setModalOpen(false)} title="Add New User">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Full Name</label>
                        <input
                            value={form.full_name}
                            onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none"
                            placeholder="e.g. Rahul Sharma"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Email Address</label>
                        <input
                            type="email"
                            required
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none"
                            placeholder="name@example.com"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Temporary Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none"
                            placeholder="Min. 6 characters"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">System Role</label>
                        <select
                            value={form.role}
                            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none cursor-pointer"
                        >
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                            <option value="user">Buyer / Tenant</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-white">Cancel</button>
                        <button type="submit" disabled={creating} className="gold-glow-btn px-5 py-2 text-xs font-bold">
                            {creating ? 'Creating...' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Reject User Modal */}
            <Modal
                isOpen={rejectModal.open}
                open={rejectModal.open}
                onClose={() => setRejectModal({ open: false, user: null, reason: '' })}
                title="Reject User Registration"
                size="sm"
            >
                <div className="p-6 space-y-4">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Rejecting registration for <strong className="text-white">{rejectModal.user?.email}</strong>. The user will see this explanation if they attempt to sign in.
                    </p>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Rejection Reason</label>
                        <textarea
                            rows={3}
                            value={rejectModal.reason}
                            onChange={(e) => setRejectModal((c) => ({ ...c, reason: e.target.value }))}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-3 text-xs text-white focus:border-rose-400 focus:outline-none"
                            placeholder="Provide a reason..."
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={() => setRejectModal({ open: false, user: null, reason: '' })}
                            className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleRejectConfirm}
                            disabled={actionLoadingId === rejectModal.user?.id}
                            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
                        >
                            {actionLoadingId === rejectModal.user?.id ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
