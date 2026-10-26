import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPayments, fetchTenants, fetchProperties, createPayment } from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import PaymentModal from '../components/PaymentModal';
import { useToast } from '../components/Toast';
import { exportDetailsToPdf } from '../utils/exportPdf';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const formatPaymentType = (value) => value === 'advance' ? 'Advance' : 'Rent';

export default function PaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [payTarget, setPayTarget] = useState(null);
    const [paySelectorOpen, setPaySelectorOpen] = useState(false);
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [form, setForm] = useState({ tenant_id: '', amount_paid: '', payment_date: new Date().toISOString().slice(0, 10), month_covered: currentMonth(), payment_type: 'rent', note: '' });
    const [filterMonth, setFilterMonth] = useState('');
    const { user, canManagePayments } = useAuth();
    const isNormalUser = ['user', 'viewer'].includes((user?.role || '').toLowerCase());
    const toast = useToast();

    const navigate = useNavigate();

    const emptyForm = { tenant_id: '', amount_paid: '', payment_date: new Date().toISOString().slice(0, 10), month_covered: currentMonth(), payment_type: 'rent', note: '' };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [pay, ten, prop] = await Promise.all([
                fetchPayments(),
                fetchTenants(),
                fetchProperties(),
            ]);
            setPayments(pay);
            setTenants(ten);
            setProperties(prop);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load payments.');
        }
        finally { setLoading(false); }
    }, [toast]);

    useEffect(() => { load(); }, [load]);

    const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t])), [tenants]);
    const propertyMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p])), [properties]);

    // Filter tenants visible to current user
    const visibleTenants = useMemo(() => {
        if (!isNormalUser) return tenants;
        return tenants.filter(t => t.user_id === user?.id || (user?.email && t.email?.toLowerCase() === user.email.toLowerCase()));
    }, [tenants, isNormalUser, user]);

    const activeTenants = useMemo(() => visibleTenants.filter(t => t.status === 'active'), [visibleTenants]);

    const userTenantIds = useMemo(() => new Set(visibleTenants.map(t => t.id)), [visibleTenants]);

    const visiblePayments = useMemo(() => {
        if (!isNormalUser) return payments;
        return payments.filter(p => userTenantIds.has(p.tenant_id));
    }, [payments, isNormalUser, userTenantIds]);

    const filteredPayments = useMemo(
        () => filterMonth ? visiblePayments.filter((payment) => payment.month_covered === filterMonth) : visiblePayments,
        [filterMonth, visiblePayments]
    );

    // Build rent tracking grid: tenant × month → paid/pending
    const months = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthNum = now.getMonth() + 1;

        if (isNormalUser && activeTenants.length > 0) {
            let startMonthNum = currentMonthNum;
            const tLeaseStart = activeTenants[0].lease_start;
            if (tLeaseStart) {
                const [ly, lm] = tLeaseStart.slice(0, 7).split('-').map(Number);
                if (ly === currentYear) {
                    startMonthNum = lm;
                } else if (ly < currentYear) {
                    startMonthNum = 1;
                } else {
                    startMonthNum = lm;
                }
            }

            const result = [];
            const endMonthNum = Math.max(startMonthNum, currentMonthNum);
            for (let m = startMonthNum; m <= endMonthNum; m++) {
                const mStr = m.toString().padStart(2, '0');
                result.push(`${currentYear}-${mStr}`);
            }
            return result;
        }

        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            result.push(d.toISOString().slice(0, 7));
        }
        return result;
    }, [isNormalUser, activeTenants]);

    const paymentTotals = useMemo(() => {
        const map = {};
        payments.forEach((payment) => {
            const key = `${payment.tenant_id}__${payment.month_covered}`;
            map[key] = (map[key] || 0) + Number(payment.amount_paid || 0);
        });
        return map;
    }, [payments]);

    // Active lease currently selected in the pay selector
    const currentSelectedTenant = useMemo(() => {
        return activeTenants.find(t => t.id === selectedTenantId) || activeTenants[0] || null;
    }, [activeTenants, selectedTenantId]);

    // Compute unpaid months in chronological order for the selected lease
    const unpaidMonthsForSelectedTenant = useMemo(() => {
        if (!currentSelectedTenant) return [];
        const tStart = (currentSelectedTenant.lease_start || '').slice(0, 7);
        return months.filter(m => {
            if (tStart && m < tStart) return false;
            const totalPaid = paymentTotals[`${currentSelectedTenant.id}__${m}`] || 0;
            const rentDue = Number(propertyMap[currentSelectedTenant.property_id]?.rent_amount || 0);
            return totalPaid < rentDue;
        });
    }, [currentSelectedTenant, months, paymentTotals, propertyMap]);

    // Keep selectedMonth in sync with oldest unpaid month
    useEffect(() => {
        if (unpaidMonthsForSelectedTenant.length > 0) {
            setSelectedMonth(unpaidMonthsForSelectedTenant[0]);
        } else {
            setSelectedMonth(months[months.length - 1] || '');
        }
    }, [unpaidMonthsForSelectedTenant, months]);

    useEffect(() => {
        if (!selectedTenantId && activeTenants.length > 0) {
            setSelectedTenantId(activeTenants[0].id);
        }
    }, [activeTenants, selectedTenantId]);

    const formatMonth = (str) => {
        if (!str) return '—';
        const [y, m] = str.split('-');
        const date = new Date(+y, +m - 1);
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    };

    const handleExportStatement = async () => {
        try {
            const totalCollected = filteredPayments.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0);
            await exportDetailsToPdf({
                title: `Rent Payments & Collections Statement`,
                subtitle: `Filter: ${filterMonth ? formatMonth(filterMonth) : 'All Months'} | Total Collected: Rs ${totalCollected.toLocaleString()}`,
                sections: [
                    {
                        title: 'Summary',
                        fields: [
                            { label: 'Total Transactions', value: filteredPayments.length },
                            { label: 'Total Amount', value: `Rs ${totalCollected.toLocaleString()}` },
                            { label: 'Export Date', value: new Date().toLocaleDateString() },
                        ]
                    }
                ],
                tables: [
                    {
                        title: 'Payment Transactions',
                        columns: ['Tenant', 'Property', 'Amount', 'Type', 'Date', 'Month Covered'],
                        rows: filteredPayments.map(p => [
                            tenantMap[p.tenant_id]?.name || 'Unknown',
                            propertyMap[tenantMap[p.tenant_id]?.property_id]?.address || '—',
                            `Rs ${Number(p.amount_paid).toLocaleString()}`,
                            formatPaymentType(p.payment_type),
                            p.payment_date,
                            formatMonth(p.month_covered)
                        ])
                    }
                ]
            });
            toast.success('Payments Statement PDF downloaded.');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export payments statement.');
        }
    };

    const openNew = () => {
        setForm({ ...emptyForm, tenant_id: activeTenants[0]?.id || '' });
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createPayment({
                ...form,
                amount_paid: Number(form.amount_paid),
                note: form.note || null,
            });
            toast.success('Payment recorded.');
            setModalOpen(false);
            setForm(emptyForm);
            load();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to save payment.');
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
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">Rent Tracking &amp; Payments</h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">Payment status across billing cycles</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleExportStatement}
                        className="px-4 py-2.5 border border-[var(--color-border)] bg-[var(--color-surface-light)]/50 hover:border-amber-400 hover:text-amber-400 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        Export Statement PDF
                    </button>
                    {isNormalUser && activeTenants.length > 0 && (
                        <button
                            onClick={() => setPaySelectorOpen(true)}
                            className="gold-glow-btn px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            💳 Pay Rent Online (Razorpay)
                        </button>
                    )}
                    {canManagePayments && (
                        <button
                            onClick={openNew}
                            className="gold-glow-btn px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                            + Record Payment
                        </button>
                    )}
                </div>
            </div>

            {/* Rent Status Grid */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-lg border border-[var(--color-border)]">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/50 text-left text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                                <th className="px-5 py-3.5 sticky left-0 bg-[var(--color-surface)] z-10">Tenant</th>
                                <th className="px-5 py-3.5">Property</th>
                                {months.map(m => <th key={m} className="px-4 py-3.5 text-center">{formatMonth(m)}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]/60 text-slate-200">
                            {activeTenants.map(t => (
                                <tr key={t.id} className="hover:bg-amber-500/5 transition-colors">
                                    <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap sticky left-0 bg-[var(--color-surface)]">{t.name}</td>
                                    <td className="px-5 py-3.5 text-[var(--color-text-muted)] whitespace-nowrap">{propertyMap[t.property_id]?.address || '—'}</td>
                                    {months.map(m => {
                                        const tenantStartMonth = (t.lease_start || '').slice(0, 7);
                                        const isBeforeStart = tenantStartMonth && m < tenantStartMonth;

                                        if (isBeforeStart) {
                                            return (
                                                <td key={m} className="px-4 py-3.5 text-center text-slate-500 text-xs font-medium">
                                                    —
                                                </td>
                                            );
                                        }

                                        const totalPaid = paymentTotals[`${t.id}__${m}`] || 0;
                                        const rentDue = Number(propertyMap[t.property_id]?.rent_amount || 0);
                                        const status = totalPaid <= 0
                                            ? 'pending'
                                            : totalPaid >= rentDue
                                                ? 'paid'
                                                : 'partial';
                                        return (
                                            <td key={m} className="px-4 py-3.5 text-center">
                                                {status === 'paid' ? (
                                                    <span className="inline-flex items-center justify-center min-w-20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                                        ✓ Paid
                                                    </span>
                                                ) : isNormalUser ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayTarget({
                                                            tenant: t,
                                                            property: propertyMap[t.property_id],
                                                            month: m,
                                                            amount: rentDue > totalPaid ? (rentDue - totalPaid) : rentDue,
                                                        })}
                                                        className="inline-flex items-center justify-center gap-1 min-w-20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 transition-all cursor-pointer shadow-sm hover:scale-105"
                                                        title={`Pay rent for ${formatMonth(m)} for ${t.name} (${propertyMap[t.property_id]?.address || 'Property'})`}
                                                    >
                                                        💳 Pay {status === 'partial' ? 'Due' : 'Now'}
                                                    </button>
                                                ) : (
                                                    <span className={`inline-flex items-center justify-center min-w-20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                        status === 'partial'
                                                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                                            : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                                                    }`}>
                                                        {status === 'partial' ? 'Partial' : 'Pending'}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}

                                </tr>
                            ))}
                            {activeTenants.length === 0 && (
                                <tr><td colSpan={2 + months.length} className="px-5 py-12 text-center text-[var(--color-text-muted)]">No active tenants to track.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Payments List */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-white tracking-tight">Recent Payment Ledger</h2>
                    <div className="flex items-center gap-3">
                        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                            className="px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                            <option value="">All Months</option>
                            {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                        </select>
                    </div>
                </div>

                <div className="glass-card rounded-2xl overflow-hidden shadow-lg border border-[var(--color-border)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/50 text-left text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                                    <th className="px-5 py-3.5">Tenant</th>
                                    <th className="px-5 py-3.5">Amount (₹)</th>
                                    <th className="px-5 py-3.5">Type</th>
                                    <th className="px-5 py-3.5">Date</th>
                                    <th className="px-5 py-3.5">Month Covered</th>
                                    <th className="px-5 py-3.5">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]/60 text-slate-200">
                                {filteredPayments.map(p => (
                                    <tr
                                        key={p.id}
                                        tabIndex={0}
                                        role="button"
                                        onClick={() => navigate(`/payments/${p.id}`)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                navigate(`/payments/${p.id}`);
                                            }
                                        }}
                                        className="hover:bg-amber-500/5 transition-colors cursor-pointer focus:outline-none"
                                    >
                                        <td className="px-5 py-3.5 font-bold text-white">{tenantMap[p.tenant_id]?.name || p.tenant_id}</td>
                                        <td className="px-5 py-3.5 font-extrabold text-emerald-400">₹{Number(p.amount_paid).toLocaleString()}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.payment_type === 'advance'
                                                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                                                    : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                                }`}>
                                                {formatPaymentType(p.payment_type)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-[var(--color-text-muted)]">{p.payment_date}</td>
                                        <td className="px-5 py-3.5 font-semibold text-white">{formatMonth(p.month_covered)}</td>
                                        <td className="px-5 py-3.5 text-[var(--color-text-muted)] max-w-[240px] truncate">{p.note || '—'}</td>
                                    </tr>
                                ))}
                                {filteredPayments.length === 0 && (
                                    <tr><td colSpan={6} className="px-5 py-12 text-center text-[var(--color-text-muted)]">No payments recorded.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Record / Edit Payment Modal */}
            {canManagePayments && (
                <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Rent Payment">
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Tenant *</label>
                        <select required value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                            <option value="">Select tenant…</option>
                            {activeTenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Amount (₹) *</label>
                            <input type="number" min="0.01" step="0.01" required value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)}
                                placeholder="15000"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Month Covered *</label>
                            <input type="month" required value={form.month_covered} onChange={e => set('month_covered', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Payment Type *</label>
                            <select value={form.payment_type} onChange={e => set('payment_type', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                                <option value="rent">Rent</option>
                                <option value="advance">Advance</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Payment Date</label>
                            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Note</label>
                        <textarea
                            rows="3"
                            value={form.note}
                            onChange={e => set('note', e.target.value)}
                            placeholder="Add a payment note or reference..."
                            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer">Cancel</button>
                        <button type="submit" className="gold-glow-btn px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer">Record Payment</button>
                    </div>
                    </form>
                </Modal>
            )}

            {/* Choose Lease & Month Selector Modal */}
            {paySelectorOpen && (
                <Modal
                    isOpen={paySelectorOpen}
                    open={paySelectorOpen}
                    onClose={() => setPaySelectorOpen(false)}
                    title="Pay Rent Online (Select Lease & Month)"
                    size="md"
                >
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                                Select Rented Property / Lease *
                            </label>
                            <select
                                value={selectedTenantId}
                                onChange={(e) => setSelectedTenantId(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors font-medium"
                            >
                                {activeTenants.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} — {propertyMap[t.property_id]?.address || 'Property'} (Rent: ₹{Number(propertyMap[t.property_id]?.rent_amount || 0).toLocaleString('en-IN')}/mo)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)]">
                                    Billing Month (in chronological order) *
                                </label>
                                <span className="text-[10px] text-amber-400 font-semibold">Oldest pending first</span>
                            </div>
                            {unpaidMonthsForSelectedTenant.length > 0 ? (
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors font-mono font-bold"
                                >
                                    {unpaidMonthsForSelectedTenant.map((m) => {
                                        const rentDue = Number(propertyMap[currentSelectedTenant?.property_id]?.rent_amount || 0);
                                        const paid = paymentTotals[`${currentSelectedTenant?.id}__${m}`] || 0;
                                        const pending = rentDue - paid;
                                        return (
                                            <option key={m} value={m}>
                                                {formatMonth(m)} — Due: ₹{pending.toLocaleString('en-IN')} (Pending)
                                            </option>
                                        );
                                    })}
                                </select>
                            ) : (
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                                    ✓ All rental cycles are completely paid for this property!
                                </div>
                            )}
                        </div>

                        {currentSelectedTenant && (
                            <div className="rounded-xl bg-[var(--color-surface-dark)] p-3 border border-[var(--color-border)] space-y-1 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-muted)]">Tenant Name:</span>
                                    <span className="font-semibold text-white">{currentSelectedTenant.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-muted)]">Property:</span>
                                    <span className="font-semibold text-white">{propertyMap[currentSelectedTenant.property_id]?.address || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-muted)]">Selected Month:</span>
                                    <span className="font-semibold text-amber-400">{formatMonth(selectedMonth)}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-[var(--color-border)]">
                                    <span className="text-[var(--color-text-muted)] font-bold">Total Rent Payable:</span>
                                    <span className="font-extrabold text-amber-300 text-sm">
                                        ₹{Number(propertyMap[currentSelectedTenant.property_id]?.rent_amount || 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
                            <button
                                type="button"
                                onClick={() => setPaySelectorOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!currentSelectedTenant || unpaidMonthsForSelectedTenant.length === 0}
                                onClick={() => {
                                    setPaySelectorOpen(false);
                                    const rentDue = Number(propertyMap[currentSelectedTenant.property_id]?.rent_amount || 0);
                                    const paid = paymentTotals[`${currentSelectedTenant.id}__${selectedMonth}`] || 0;
                                    setPayTarget({
                                        tenant: currentSelectedTenant,
                                        property: propertyMap[currentSelectedTenant.property_id],
                                        month: selectedMonth,
                                        amount: rentDue > paid ? (rentDue - paid) : rentDue,
                                    });
                                }}
                                className="gold-glow-btn px-5 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                            >
                                Proceed to Checkout →
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Online Razorpay Payment Modal */}
            {payTarget && (
                <PaymentModal
                    tenant={payTarget.tenant}
                    property={payTarget.property}
                    amount={payTarget.amount}
                    monthCovered={payTarget.month}
                    onClose={() => setPayTarget(null)}
                    onSuccess={async () => {
                        setPayTarget(null);
                        toast.success(`Rent payment for ${formatMonth(payTarget.month)} recorded successfully!`);
                        await load();
                    }}
                />
            )}
        </div>
    );
}
