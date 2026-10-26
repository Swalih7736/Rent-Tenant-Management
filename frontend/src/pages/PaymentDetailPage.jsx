import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deletePayment, fetchPayment, fetchProperties, fetchTenants, updatePayment } from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { exportDetailsToPdf } from '../utils/exportPdf';

function paymentToForm(payment) {
    return {
        tenant_id: payment.tenant_id,
        amount_paid: payment.amount_paid,
        payment_date: payment.payment_date,
        month_covered: payment.month_covered,
        payment_type: payment.payment_type || 'rent',
        note: payment.note || '',
    };
}

function formatMonth(value) {
    const [year, month] = value.split('-');
    return new Date(+year, +month - 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });
}

function formatPaymentType(value) {
    return value === 'advance' ? 'Advance' : 'Rent';
}

function DetailStat({ label, value, tone = 'default' }) {
    const toneClass = tone === 'success'
        ? 'from-emerald-500/15 to-transparent border-emerald-500/25 text-emerald-400'
        : tone === 'accent'
            ? 'from-amber-500/15 to-transparent border-amber-500/25 text-amber-400'
            : 'from-white/6 to-transparent border-white/8 text-white';

    return (
        <div className={`rounded-2xl border bg-gradient-to-br ${toneClass} px-4 py-4 backdrop-blur-sm`}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-[var(--color-text-muted)] font-bold">{label}</p>
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

export default function PaymentDetailPage() {
    const { paymentId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { canManagePayments } = useAuth();
    const [payment, setPayment] = useState(null);
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [form, setForm] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [paymentData, tenantsData, propertiesData] = await Promise.all([
                fetchPayment(paymentId),
                fetchTenants(),
                fetchProperties(),
            ]);
            setPayment(paymentData);
            setTenants(tenantsData);
            setProperties(propertiesData);
            setForm(paymentToForm(paymentData));
        } catch (err) {
            console.error(err);
            setPayment(null);
            toast.error('Failed to load payment details.');
        } finally {
            setLoading(false);
        }
    }, [paymentId, toast]);

    useEffect(() => { load(); }, [load]);

    const tenantMap = useMemo(
        () => Object.fromEntries(tenants.map((tenant) => [tenant.id, tenant])),
        [tenants]
    );
    const propertyMap = useMemo(
        () => Object.fromEntries(properties.map((property) => [property.id, property])),
        [properties]
    );

    const tenant = tenantMap[payment?.tenant_id];
    const property = propertyMap[tenant?.property_id];
    const paymentType = payment?.payment_type || 'rent';

    const selectableTenants = useMemo(() => {
        if (!payment) return [];
        return tenants.filter((tenantItem) => tenantItem.status === 'active' || tenantItem.id === payment.tenant_id);
    }, [payments, tenants]);

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

    const handleExport = async () => {
        try {
            await exportDetailsToPdf({
                title: `Payment Receipt - ${payment.payment_date}`,
                subtitle: `${tenant?.name || 'Unknown tenant'} • ${formatMonth(payment.month_covered)}`,
                sections: [
                    {
                        title: 'Payment Details',
                        fields: [
                            { label: 'Amount Paid', value: `Rs ${Number(payment.amount_paid).toLocaleString()}` },
                            { label: 'Payment Type', value: formatPaymentType(paymentType) },
                            { label: 'Payment Date', value: payment.payment_date },
                            { label: 'Month Covered', value: formatMonth(payment.month_covered) },
                            { label: 'Payment Method', value: payment.payment_method || 'Online / Record' },
                            { label: 'Reference / ID', value: payment.payment_gateway_payment_id || payment.id },
                        ],
                    },
                    {
                        title: 'Tenant & Property',
                        fields: [
                            { label: 'Tenant Name', value: tenant?.name || 'Unknown' },
                            { label: 'Property', value: property?.address || 'N/A' },
                            { label: 'Unit', value: tenant?.unit_number || 'N/A' },
                            { label: 'Phone', value: tenant?.phone || 'N/A' },
                        ],
                    },
                    {
                        title: 'Note',
                        fields: [
                            { label: 'Note', value: payment.note || 'No additional note' },
                        ],
                    },
                ],
            });
            toast.success('Payment PDF downloaded.');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export payment PDF.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const updated = await updatePayment(paymentId, {
                tenant_id: form.tenant_id,
                amount_paid: Number(form.amount_paid),
                payment_date: form.payment_date,
                month_covered: form.month_covered,
                payment_type: form.payment_type,
                note: form.note || null,
            });
            setPayment(updated);
            setForm(paymentToForm(updated));
            setModalOpen(false);
            toast.success('Payment updated.');
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to update payment.');
        }
    };

    const handleDelete = async () => {
        const confirmed = await toast.confirm('Delete this payment record?', {
            title: 'Confirm deletion',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        try {
            await deletePayment(paymentId);
            toast.success('Payment deleted.');
            navigate('/payments');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete payment.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    if (!payment || !form) {
        return (
            <div className="space-y-6 animate-fade-in-up">
                <Link to="/payments" className="inline-flex text-xs font-bold text-amber-400 hover:underline">
                    ← Back to payments
                </Link>
                <div className="rounded-2xl border border-[var(--color-border)] glass-card p-6">
                    <h1 className="text-xl font-bold text-white">Payment not found</h1>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">The payment details could not be loaded.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative isolate space-y-6 animate-fade-in-up">
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_40%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_38%)]" />

            <div className="overflow-hidden rounded-[32px] border border-[var(--color-border)] glass-card shadow-2xl">
                <div className="flex flex-col gap-6 px-6 py-6 lg:px-8 lg:py-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <Link to="/payments" className="mb-4 inline-flex text-xs font-bold text-amber-400 hover:underline">
                                ← Back to payments
                            </Link>
                            <div className="flex items-start gap-4">
                                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-2xl font-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300/40">
                                    ₹
                                </div>
                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                                            {formatPaymentType(paymentType)} payment
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--color-text-muted)] font-semibold">
                                            {formatMonth(payment.month_covered)}
                                        </span>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${paymentType === 'advance'
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                            {formatPaymentType(paymentType)}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">₹{Number(payment.amount_paid).toLocaleString()}</h1>
                                    <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--color-text-muted)]">
                                        Payment timeline, tenant context, and receipt history in one view so adjustments and verification are faster.
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
                            {canManagePayments && (
                                <>
                                <button
                                    onClick={() => setModalOpen(true)}
                                    className="gold-glow-btn rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Edit Payment
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <DetailStat label="Amount" value={`₹${Number(payment.amount_paid).toLocaleString()}`} tone="success" />
                        <DetailStat label="Type" value={formatPaymentType(paymentType)} tone="accent" />
                        <DetailStat label="Payment Date" value={payment.payment_date} />
                        <DetailStat label="Covered Month" value={formatMonth(payment.month_covered)} tone="accent" />
                        <DetailStat label="Tenant" value={tenant?.name || 'Unknown'} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
                <DetailBlock eyebrow="Payment Record" title="Receipt Details" accent="rgba(245,158,11,.75)">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Amount</p>
                            <p className="text-xl font-extrabold tracking-tight text-emerald-400">₹{Number(payment.amount_paid).toLocaleString()}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Payment Type</p>
                            <p className="text-sm font-bold text-white">{formatPaymentType(paymentType)}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Payment Date</p>
                            <p className="text-sm font-bold text-white">{payment.payment_date}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Month Covered</p>
                            <p className="text-sm font-bold text-white">{formatMonth(payment.month_covered)}</p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-amber-400 font-bold">Receipt Note</p>
                                <h3 className="text-sm font-bold text-white tracking-tight">Payment memo</h3>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                {payment.note ? 'Has note' : 'No note'}
                            </span>
                        </div>
                        <p className="text-xs leading-6 text-slate-300">
                            {payment.note || 'No payment note has been recorded for this entry.'}
                        </p>
                    </div>
                </DetailBlock>

                <DetailBlock eyebrow="Associated Entities" title="Linked Tenant & Property" accent="rgba(245,158,11,.75)">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-1 text-[10px] uppercase tracking-wider text-amber-400 font-bold">Tenant</p>
                            <h3 className="text-sm font-bold text-white">{tenant?.name || 'Unknown tenant'}</h3>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{tenant?.email || 'No email provided'}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{tenant?.phone || 'No phone number'}</p>
                        </div>

                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-1 text-[10px] uppercase tracking-wider text-amber-400 font-bold">Property</p>
                            <h3 className="text-sm font-bold text-white">{property?.address || 'Unknown property'}</h3>
                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                {tenant?.unit_number ? `Unit ${tenant.unit_number}` : 'Unit not specified'}
                            </p>
                        </div>
                    </div>
                </DetailBlock>
            </div>

            {canManagePayments && (
                <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Payment Record">
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Tenant *</label>
                        <select required value={form.tenant_id} onChange={(e) => set('tenant_id', e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none">
                            <option value="">Select tenant…</option>
                            {selectableTenants.map((tenantItem) => <option key={tenantItem.id} value={tenantItem.id}>{tenantItem.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Amount (₹) *</label>
                            <input type="number" min="0.01" step="0.01" required value={form.amount_paid} onChange={(e) => set('amount_paid', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Month Covered *</label>
                            <input type="month" required value={form.month_covered} onChange={(e) => set('month_covered', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Payment Type *</label>
                            <select value={form.payment_type} onChange={(e) => set('payment_type', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none">
                                <option value="rent">Rent</option>
                                <option value="advance">Advance</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Payment Date</label>
                            <input type="date" value={form.payment_date} onChange={(e) => set('payment_date', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Note</label>
                        <textarea
                            rows="3"
                            value={form.note}
                            onChange={(e) => set('note', e.target.value)}
                            placeholder="Add a payment note or reference..."
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
