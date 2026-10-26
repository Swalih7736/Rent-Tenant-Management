import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProperties, createProperty } from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const emptyForm = { address: '', total_units: 1, rent_amount: '', note: '' };

export default function PropertiesPage() {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const { canManageProperties } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setProperties(await fetchProperties());
        } catch (e) {
            console.error(e);
            toast.error('Failed to load properties.');
        }
        finally { setLoading(false); }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => { setForm(emptyForm); setModalOpen(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createProperty(form);
            toast.success('Property added.');
            setModalOpen(false);
            setForm(emptyForm);
            load();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to save property.');
        }
    };

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">Properties Management</h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">{properties.length} luxury propert{properties.length === 1 ? 'y' : 'ies'} registered</p>
                </div>
                {canManageProperties && (
                    <button
                        onClick={openNew}
                        className="gold-glow-btn px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer self-start sm:self-auto"
                    >
                        + Add Property
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-lg border border-[var(--color-border)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/50 text-left text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                                <th className="px-5 py-3.5">Property name</th>
                                <th className="px-5 py-3.5">Total Units</th>
                                <th className="px-5 py-3.5">Rent Amount (₹)</th>
                                <th className="px-5 py-3.5">Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]/60 text-slate-200">
                            {properties.map(p => (
                                <tr
                                    key={p.id}
                                    tabIndex={0}
                                    role="button"
                                    onClick={() => navigate(`/properties/${p.id}`)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate(`/properties/${p.id}`);
                                        }
                                    }}
                                    className="cursor-pointer transition-colors hover:bg-amber-500/5 focus:bg-amber-500/5 focus:outline-none"
                                >
                                    <td className="px-5 py-4 font-bold text-white flex items-center gap-2">
                                        <span className="text-amber-400">🏢</span>
                                        <span>{p.address}</span>
                                    </td>
                                    <td className="px-5 py-4 font-semibold">{p.total_units} units</td>
                                    <td className="px-5 py-4 font-bold text-amber-400">₹{Number(p.rent_amount).toLocaleString()}</td>
                                    <td className="px-5 py-4 text-[var(--color-text-muted)] max-w-[200px] truncate">{p.note || '—'}</td>
                                </tr>
                            ))}
                            {properties.length === 0 && (
                                <tr><td colSpan={4} className="px-5 py-12 text-center text-[var(--color-text-muted)]">No properties found. Click "+ Add Property" above to create one.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {canManageProperties && (
                <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add New Property">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Property Name / Address</label>
                            <input
                                required value={form.address} onChange={e => set('address', e.target.value)}
                                placeholder="e.g. Royal Heights Residency"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Total Units</label>
                                <input
                                    type="number" min="1" required value={form.total_units} onChange={e => set('total_units', +e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Rent Amount (₹)</label>
                                <input
                                    type="number" min="0" step="0.01" required value={form.rent_amount} onChange={e => set('rent_amount', +e.target.value)}
                                    placeholder="25000"
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Note / Description</label>
                            <textarea
                                rows="3" value={form.note} onChange={e => set('note', e.target.value)}
                                placeholder="Add any additional details about this property..."
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer">Cancel</button>
                            <button type="submit" className="gold-glow-btn px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer">Add Property</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
