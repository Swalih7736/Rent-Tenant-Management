import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    deleteProperty,
    fetchPayments,
    fetchProperty,
    fetchTenants,
    updateProperty,
} from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { exportDetailsToPdf } from '../utils/exportPdf';

function propertyToForm(property) {
    return {
        address: property.address,
        total_units: property.total_units,
        rent_amount: property.rent_amount,
        note: property.note || '',
    };
}

function DetailStat({ label, value, tone = 'default' }) {
    const toneClass = tone === 'success'
        ? 'from-emerald-500/15 to-transparent border-emerald-500/25 text-emerald-400'
        : tone === 'accent'
            ? 'from-amber-500/15 to-transparent border-amber-500/25 text-amber-400'
            : 'from-white/6 to-transparent border-white/8 text-white';

    return (
        <div className={`rounded-2xl border bg-gradient-to-br ${toneClass} px-4 py-4 backdrop-blur-sm`}>
            <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-[var(--color-text-muted)] font-bold">{label}</p>
            <p className="text-xl font-extrabold tracking-tight">{value}</p>
        </div>
    );
}

function DetailBlock({ eyebrow, title, children, accent = 'var(--color-primary)' }) {
    return (
        <section className="relative overflow-hidden rounded-[28px] border border-[var(--color-border)] glass-card p-6 shadow-2xl">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.28em] text-amber-400 font-bold">{eyebrow}</p>
            <h2 className="mb-5 text-xl font-extrabold tracking-tight text-white">{title}</h2>
            {children}
        </section>
    );
}

export default function PropertyDetailPage() {
    const { propertyId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { canManageProperties } = useAuth();
    const [property, setProperty] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [payments, setPayments] = useState([]);
    const [form, setForm] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [propertyData, allTenants, allPayments] = await Promise.all([
                fetchProperty(propertyId),
                fetchTenants({ property_id: propertyId }),
                fetchPayments(),
            ]);
            setProperty(propertyData);
            setTenants(allTenants);
            setPayments(allPayments);
            setForm(propertyToForm(propertyData));
        } catch (err) {
            console.error(err);
            setProperty(null);
            toast.error('Failed to load property details.');
        } finally {
            setLoading(false);
        }
    }, [propertyId, toast]);

    useEffect(() => { load(); }, [load]);

    const activeTenants = useMemo(
        () => tenants.filter((tenant) => tenant.status === 'active'),
        [tenants]
    );
    const occupiedUnits = activeTenants.length;
    const availableUnits = Math.max(Number(property?.total_units || 0) - occupiedUnits, 0);
    const occupancy = property?.total_units ? Math.round((occupiedUnits / property.total_units) * 100) : 0;
    const propertyTenantIds = useMemo(() => new Set(tenants.map((tenant) => tenant.id)), [tenants]);
    const propertyPayments = useMemo(
        () => payments.filter((payment) => propertyTenantIds.has(payment.tenant_id)),
        [payments, propertyTenantIds]
    );
    const recentPayments = useMemo(
        () => [...propertyPayments].sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 4),
        [propertyPayments]
    );
    const monthlyRunRate = Number(property?.rent_amount || 0) * occupiedUnits;

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const handleExport = async () => {
        try {
            await exportDetailsToPdf({
                title: `Property Summary - ${property.address}`,
                subtitle: `${occupiedUnits} occupied of ${property.total_units} total units`,
                sections: [
                    {
                        title: 'Overview',
                        fields: [
                            { label: 'Property Name', value: property.address },
                            { label: 'Rent / Unit', value: `₹${Number(property.rent_amount).toLocaleString()}` },
                            { label: 'Total Units', value: property.total_units },
                            { label: 'Occupied Units', value: occupiedUnits },
                            { label: 'Available Units', value: availableUnits },
                            { label: 'Monthly Run Rate', value: `₹${monthlyRunRate.toLocaleString()}` },
                        ],
                    },
                    {
                        title: 'Property Note',
                        fields: [
                            { label: 'Note', value: property.note || 'No additional note' },
                        ],
                    },
                ],
                tables: [
                    {
                        title: 'Active Tenants',
                        columns: ['Name', 'Unit', 'Rent Due', 'Phone'],
                        rows: activeTenants.map((tenant) => [
                            tenant.name,
                            tenant.unit_number ? `Unit ${tenant.unit_number}` : 'N/A',
                            `Day ${tenant.rent_due_day}`,
                            tenant.phone || 'N/A',
                        ]),
                    },
                    {
                        title: 'Recent Payments',
                        columns: ['Date', 'Amount', 'Status'],
                        rows: recentPayments.map((payment) => [
                            payment.payment_date,
                            `₹${Number(payment.amount_paid).toLocaleString()}`,
                            payment.payment_status || 'Completed',
                        ]),
                    },
                ],
            });
            toast.success('Property PDF downloaded.');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export property PDF.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const updated = await updateProperty(propertyId, {
                address: form.address,
                total_units: Number(form.total_units),
                rent_amount: Number(form.rent_amount),
                note: form.note,
            });
            setProperty(updated);
            setForm(propertyToForm(updated));
            setModalOpen(false);
            toast.success('Property updated.');
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to update property.');
        }
    };

    const handleDelete = async () => {
        const confirmed = await toast.confirm('Delete this property and all its tenants?', {
            title: 'Confirm deletion',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        try {
            await deleteProperty(propertyId);
            toast.success('Property deleted.');
            navigate('/properties');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete property.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    if (!property || !form) {
        return (
            <div className="space-y-6 animate-fade-in-up">
                <Link to="/properties" className="inline-flex text-xs font-bold text-amber-400 hover:underline">
                    ← Back to properties
                </Link>
                <div className="rounded-2xl border border-[var(--color-border)] glass-card p-6">
                    <h1 className="text-xl font-bold text-white">Property not found</h1>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">The property details could not be loaded.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative isolate space-y-6 animate-fade-in-up">
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_40%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_40%)]" />

            <div className="overflow-hidden rounded-[32px] border border-[var(--color-border)] glass-card shadow-2xl">
                <div className="flex flex-col gap-6 px-6 py-6 lg:px-8 lg:py-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <Link to="/properties" className="mb-4 inline-flex text-xs font-bold text-amber-400 hover:underline">
                                ← Back to properties
                            </Link>
                            <div className="flex items-start gap-4">
                                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-2xl font-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300/40">
                                    P
                                </div>
                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
                                            {property.total_units} total units
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                                            {occupiedUnits} occupied
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{property.address}</h1>
                                    <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--color-text-muted)]">
                                        Property performance, occupancy, and resident activity gathered into one place so management decisions feel faster and clearer.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                            <button
                                onClick={handleExport}
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-light)]/50 px-5 py-2.5 text-xs font-bold text-white transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:text-amber-400 cursor-pointer"
                            >
                                Export PDF
                            </button>
                            {canManageProperties && (
                                <>
                                <button
                                    onClick={() => setModalOpen(true)}
                                    className="gold-glow-btn rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Edit Property
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 cursor-pointer"
                                >
                                    Delete
                                </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailStat label="Rent / Unit" value={`₹${Number(property.rent_amount).toLocaleString()}`} tone="accent" />
                        <DetailStat label="Occupancy" value={`${occupancy}%`} tone="success" />
                        <DetailStat label="Available Units" value={availableUnits} />
                        <DetailStat label="Run Rate" value={`₹${monthlyRunRate.toLocaleString()}`} tone="accent" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
                <DetailBlock eyebrow="Property Overview" title="Capacity and Notes" accent="rgba(245,158,11,.75)">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Total Units</p>
                            <p className="text-2xl font-extrabold tracking-tight text-white">{property.total_units}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Active Tenants</p>
                            <p className="text-2xl font-extrabold tracking-tight text-emerald-400">{occupiedUnits}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Available Units</p>
                            <p className="text-2xl font-extrabold tracking-tight text-amber-400">{availableUnits}</p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Property Note</p>
                                <h3 className="text-sm font-bold text-white tracking-tight">Manager context</h3>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                {property.note ? 'Has note' : 'No note'}
                            </span>
                        </div>
                        <p className="text-xs leading-6 text-slate-300">
                            {property.note || 'No additional property note has been added yet.'}
                        </p>
                    </div>
                </DetailBlock>

                <DetailBlock eyebrow="Residents" title="Tenant Snapshot" accent="rgba(245,158,11,.75)">
                    <div className="space-y-4">
                        {activeTenants.length > 0 ? (
                            activeTenants.slice(0, 4).map((tenant) => (
                                <Link
                                    key={tenant.id}
                                    to={`/tenants/${tenant.id}`}
                                    className="block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-4 transition-all hover:border-amber-400/40 hover:bg-amber-500/5"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-white tracking-tight">{tenant.name}</p>
                                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                                {tenant.unit_number ? `Unit ${tenant.unit_number}` : 'Unit not assigned'}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                            {tenant.status}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                                <p className="text-xs text-[var(--color-text-muted)]">No active tenants are linked to this property yet.</p>
                            </div>
                        )}

                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-3 text-[10px] uppercase tracking-wider text-amber-400 font-bold">Recent Payment Activity</p>
                            {recentPayments.length > 0 ? (
                                <div className="space-y-2.5">
                                    {recentPayments.map((payment) => {
                                        const tenant = tenants.find((item) => item.id === payment.tenant_id);
                                        return (
                                            <Link
                                                key={payment.id}
                                                to={`/payments/${payment.id}`}
                                                className="flex items-center justify-between gap-3 text-xs text-[var(--color-text-muted)] hover:text-amber-300 transition-colors"
                                            >
                                                <span className="font-medium text-white">{tenant?.name || 'Unknown tenant'}</span>
                                                <span className="font-bold text-emerald-400">₹{Number(payment.amount_paid).toLocaleString()}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--color-text-muted)]">No payments recorded for this property yet.</p>
                            )}
                        </div>
                    </div>
                </DetailBlock>
            </div>

            {canManageProperties && (
                <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Property">
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Property name</label>
                        <input
                            required
                            value={form.address}
                            onChange={(e) => set('address', e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Total Units</label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={form.total_units}
                                onChange={(e) => set('total_units', +e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Rent Amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                required
                                value={form.rent_amount}
                                onChange={(e) => set('rent_amount', +e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Note</label>
                        <textarea
                            rows="3"
                            value={form.note}
                            onChange={(e) => set('note', e.target.value)}
                            placeholder="Add any additional details about this property..."
                            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-white cursor-pointer">Cancel</button>
                        <button type="submit" className="gold-glow-btn px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer">
                            Save Changes
                        </button>
                    </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
