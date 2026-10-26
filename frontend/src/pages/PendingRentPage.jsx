import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPayments, fetchProperties, fetchTenants } from '../api';
import { useToast } from '../components/Toast';

const SORT_OPTIONS = [
    { value: 'highest', label: 'Highest Amount' },
    { value: 'oldest', label: 'Oldest (Lease Start)' },
    { value: 'newest', label: 'Newest (Lease Start)' },
];

export default function PendingRentPage() {
    const [pendingItems, setPendingItems] = useState([]);
    const [totalPending, setTotalPending] = useState(0);
    const [currentMonthLabel, setCurrentMonthLabel] = useState('');
    const [sortBy, setSortBy] = useState('highest');
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        async function load() {
            try {
                const currentMonth = new Date().toISOString().slice(0, 7);
                const label = new Date(`${currentMonth}-01`).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                });
                setCurrentMonthLabel(label);

                const [properties, tenants, payments] = await Promise.all([
                    fetchProperties(),
                    fetchTenants(),
                    fetchPayments({ month_covered: currentMonth }),
                ]);

                const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));
                const activeTenants = tenants.filter(t => t.status === 'active');
                const paidByTenant = payments.reduce((acc, payment) => {
                    acc[payment.tenant_id] = (acc[payment.tenant_id] || 0) + Number(payment.amount_paid || 0);
                    return acc;
                }, {});

                const items = activeTenants
                    .map((tenant) => {
                        const property = propertyMap[tenant.property_id];
                        const rentAmount = Number(property?.rent_amount || 0);
                        const paidAmount = Number(paidByTenant[tenant.id] || 0);
                        const pendingAmount = Math.max(rentAmount - paidAmount, 0);
                        if (pendingAmount <= 0) return null;
                        return {
                            id: tenant.id,
                            tenantName: tenant.name,
                            propertyName: property?.address || 'Unknown Property',
                            unitNumber: tenant.unit_number,
                            paidAmount,
                            pendingAmount,
                            rentAmount,
                            leaseStart: tenant.lease_start,
                        };
                    })
                    .filter(Boolean);

                setTotalPending(items.reduce((sum, item) => sum + item.pendingAmount, 0));
                setPendingItems(items);
            } catch (err) {
                console.error('Pending rent load error:', err);
                toast.error('Failed to load pending rent data.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [toast]);

    const sortedItems = useMemo(() => {
        const copy = [...pendingItems];
        switch (sortBy) {
            case 'highest':
                return copy.sort((a, b) => b.pendingAmount - a.pendingAmount);
            case 'oldest':
                return copy.sort((a, b) => {
                    if (!a.leaseStart) return 1;
                    if (!b.leaseStart) return -1;
                    return new Date(a.leaseStart) - new Date(b.leaseStart);
                });
            case 'newest':
                return copy.sort((a, b) => {
                    if (!b.leaseStart) return 1;
                    if (!a.leaseStart) return -1;
                    return new Date(b.leaseStart) - new Date(a.leaseStart);
                });
            default:
                return copy;
        }
    }, [pendingItems, sortBy]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]/50">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => navigate('/')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Dashboard
                        </button>
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight">
                        Pending <span className="gold-gradient-text">Rent Ledger</span>
                    </h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">
                        {sortedItems.length} tenant{sortedItems.length === 1 ? '' : 's'} with outstanding rent for <span className="text-[var(--color-text)] font-semibold">{currentMonthLabel}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-gradient-to-r from-rose-500/15 to-amber-500/10 border border-rose-500/30 text-rose-400 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-rose-950/20 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                        Total Overdue: ₹{totalPending.toLocaleString()}
                    </div>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="px-4 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all cursor-pointer font-medium"
                    >
                        {SORT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Pending tenants list */}
            {sortedItems.length > 0 ? (
                <div className="space-y-4">
                    {sortedItems.map((item, index) => (
                        <div
                            key={item.id}
                            className="glass-card rounded-2xl p-6 transition-all duration-300 hover:border-[var(--color-primary)]/40 hover:shadow-xl hover:shadow-[var(--color-primary)]/5"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center text-lg font-bold text-[var(--color-primary)] shrink-0 shadow-inner">
                                        {item.tenantName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-lg text-[var(--color-text)]">{item.tenantName}</p>
                                        <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-2 mt-0.5">
                                            <span>{item.propertyName}</span>
                                            {item.unitNumber && (
                                                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[var(--color-primary)] text-xs font-semibold rounded-md">
                                                    Unit {item.unitNumber}
                                                </span>
                                            )}
                                        </p>
                                        {item.leaseStart && (
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                Lease Start: {new Date(item.leaseStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-6 text-sm bg-[var(--color-surface-dark)]/60 border border-[var(--color-border)]/60 px-5 py-3 rounded-xl">
                                    <div className="text-center min-w-[70px]">
                                        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-semibold mb-0.5">Rent</p>
                                        <p className="font-bold text-base text-[var(--color-text)]">₹{item.rentAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="w-px h-8 bg-[var(--color-border)]" />
                                    <div className="text-center min-w-[70px]">
                                        <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wider font-semibold mb-0.5">Paid</p>
                                        <p className="font-bold text-base text-emerald-400">₹{item.paidAmount.toLocaleString()}</p>
                                    </div>
                                    <div className="w-px h-8 bg-[var(--color-border)]" />
                                    <div className="text-center min-w-[80px]">
                                        <p className="text-rose-400/80 text-xs uppercase tracking-wider font-bold mb-0.5">Pending</p>
                                        <p className="font-extrabold text-rose-400 text-lg">₹{item.pendingAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-5 pt-4 border-t border-[var(--color-border)]/40">
                                <div className="flex justify-between items-center text-xs font-semibold text-[var(--color-text-muted)] mb-1.5">
                                    <span>Collection Progress</span>
                                    <span className="text-[var(--color-text)]">
                                        {item.rentAmount > 0 ? Math.round((item.paidAmount / item.rentAmount) * 100) : 0}% settled
                                    </span>
                                </div>
                                <div className="w-full bg-[var(--color-surface-dark)] rounded-full h-2.5 overflow-hidden border border-[var(--color-border)]/40 p-[1px]">
                                    <div
                                        className="h-full rounded-full transition-all duration-500 shadow-sm"
                                        style={{
                                            width: `${Math.min((item.paidAmount / item.rentAmount) * 100, 100)}%`,
                                            background: item.paidAmount > 0 
                                                ? 'linear-gradient(90deg, #10b981, #059669)' 
                                                : 'linear-gradient(90deg, #f43f5e, #e11d48)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-card rounded-2xl p-12 text-center border-emerald-500/30">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-3xl mx-auto mb-4 text-emerald-400">
                        ✓
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text)]">All Clear!</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-md mx-auto">
                        No pending rent for {currentMonthLabel}. Every active lease is 100% paid and up to date.
                    </p>
                </div>
            )}
        </div>
    );
}
