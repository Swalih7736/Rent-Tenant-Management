import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import {
    fetchPayments,
    fetchProperties,
    fetchTenants,
    fetchRevenue,
    fetchMyActiveRental,
    fetchOwnerRentalRequests,
    resubmitApplicationIdProof,
    triggerPaymentWebhook,
} from '../api';
import { useToast } from '../components/Toast';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import PaymentModal from '../components/PaymentModal';

export default function DashboardPage() {
    const { user } = useAuth();
    const isUser = user && ['user', 'viewer'].includes((user.role || '').toLowerCase());
    const isOwnerOrAdmin = user && ['owner', 'admin', 'manager'].includes((user.role || '').toLowerCase());

    const toast = useToast();
    const navigate = useNavigate();
    const [payModalItem, setPayModalItem] = useState(null);

    // Owner / Admin stats
    const [stats, setStats] = useState({
        properties: 0,
        tenants: 0,
        revenue: 0,
        occupancy: 0,
        pendingAmount: 0,
        pendingCount: 0,
        pendingItems: [],
        currentMonthLabel: '',
        pendingRequestsCount: 0,
    });

    // User rental details
    const [userRental, setUserRental] = useState({
        has_active_rental: false,
        tenant: null,
        property: null,
        owner: null,
        monthly_rent: 0,
        rent_due_day: 1,
        next_due_date: '',
        current_month_status: 'PENDING',
        payment_schedule: [],
        applications: [],
    });

    const [loading, setLoading] = useState(true);

    // Resubmit ID Modal
    const [resubmitModalApp, setResubmitModalApp] = useState(null);
    const [resubmitFile, setResubmitFile] = useState(null);
    const [resubmitting, setResubmitting] = useState(false);

    // Quick simulated pay rent loading
    const [payingMonth, setPayingMonth] = useState(null);

    const loadUserData = async () => {
        try {
            const data = await fetchMyActiveRental();
            setUserRental(data);
        } catch (err) {
            console.error('Failed to load user rental data:', err);
            toast.error('Failed to load rental details.');
        }
    };

    const loadOwnerData = async () => {
        try {
            const currentMonth = new Date().toISOString().slice(0, 7);
            const currentMonthLabel = new Date(`${currentMonth}-01`).toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
            });

            const [properties, tenants, revenue, payments, requests] = await Promise.all([
                fetchProperties(),
                fetchTenants(),
                fetchRevenue(),
                fetchPayments({ month_covered: currentMonth }),
                fetchOwnerRentalRequests().catch(() => []),
            ]);

            const totalUnits = properties.reduce((s, p) => s + (p.total_units || 0), 0);
            const activeTenants = tenants.filter((t) => t.status === 'active');
            const occupancyPercent = totalUnits > 0 ? Math.round((activeTenants.length / totalUnits) * 100) : 0;
            const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
            const paidByTenant = payments.reduce((acc, payment) => {
                acc[payment.tenant_id] = (acc[payment.tenant_id] || 0) + Number(payment.amount_paid || 0);
                return acc;
            }, {});
            const pendingItems = activeTenants
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
                    };
                })
                .filter(Boolean)
                .sort((a, b) => b.pendingAmount - a.pendingAmount);
            const totalPendingAmount = pendingItems.reduce((sum, item) => sum + item.pendingAmount, 0);
            const pendingRequestsCount = requests.filter((r) => (r.status || '').toUpperCase() === 'PENDING').length;

            setStats({
                properties: properties.length,
                tenants: activeTenants.length,
                revenue: revenue.total_revenue,
                occupancy: occupancyPercent,
                pendingAmount: totalPendingAmount,
                pendingCount: pendingItems.length,
                pendingItems,
                currentMonthLabel,
                pendingRequestsCount,
            });
        } catch (err) {
            console.error('Owner dashboard load error:', err);
            toast.error('Failed to load dashboard data.');
        }
    };

    useEffect(() => {
        async function load() {
            setLoading(true);
            if (isUser) {
                await loadUserData();
            } else {
                await loadOwnerData();
            }
            setLoading(false);
        }
        load();
    }, [isUser]);

    const handleResubmitId = async (e) => {
        e.preventDefault();
        if (!resubmitFile || !resubmitModalApp) return;

        setResubmitting(true);
        try {
            const formData = new FormData();
            formData.append('id_proof', resubmitFile);
            await resubmitApplicationIdProof(resubmitModalApp.id, formData);
            toast.success('ID proof resubmitted successfully! Status updated to Under Review.');
            setResubmitModalApp(null);
            setResubmitFile(null);
            loadUserData();
        } catch (err) {
            console.error('Resubmit ID error:', err);
            toast.error(err?.response?.data?.detail || 'Failed to resubmit ID proof.');
        } finally {
            setResubmitting(false);
        }
    };

    const handlePayRentNow = (item) => {
        if (!userRental.tenant?.id) return;
        setPayModalItem(item);
    };

    const getPaymentBadge = (status) => {
        const s = (status || '').toUpperCase();
        if (s === 'PAID') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">PAID</span>;
        }
        if (s === 'OVERDUE') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">OVERDUE</span>;
        }
        if (s === 'UPCOMING') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/20 text-slate-400 border border-slate-500/20">UPCOMING</span>;
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">PENDING</span>;
    };

    const getApplicationStatusBadge = (status) => {
        const s = (status || '').toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Approved</span>;
        }
        if (s === 'REJECTED') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">Rejected</span>;
        }
        if (s === 'UNDER REVIEW') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">Under Review</span>;
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">Pending Review</span>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // USER ROLE VIEW: "My Rental Property" & Monthly Rent Status
    // ─────────────────────────────────────────────────────────────────
    if (isUser) {
        return (
            <div className="space-y-8 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">
                            Welcome back, {user?.full_name || user?.email?.split('@')[0]}!
                        </h1>
                        <p className="text-[var(--color-text-muted)] text-sm mt-1">
                            Manage your rental property, track monthly payment statuses, and view applications.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="gold-glow-btn px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer self-start sm:self-auto"
                    >
                        🛍️ Browse Marketplace
                    </button>
                </div>

                {/* 1. My Rental Property Section */}
                {userRental.has_active_rental ? (
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-lg">
                            <div className="border-b border-[var(--color-border)] px-6 py-4 bg-[var(--color-surface-light)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                    <span className="text-xl">🏡</span>
                                    <h2 className="text-lg font-bold text-white tracking-tight">My Rental Property</h2>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 self-start sm:self-auto">
                                    ● Active Lease
                                </span>
                            </div>

                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Property Info */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div>
                                        <p className="text-xs uppercase font-bold tracking-wider text-[var(--color-primary-light)]">
                                            Rented Property &amp; Unit
                                        </p>
                                        <h3 className="text-xl font-bold text-white mt-1">
                                            {userRental.property?.address || 'Green Valley Apartment'}
                                        </h3>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                            Unit / Room: <strong className="text-white">{userRental.tenant?.unit_number || 'Unit-1'}</strong>
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                                        <div className="rounded-xl bg-[var(--color-surface-dark)] p-3.5 border border-[var(--color-border)]">
                                            <p className="text-[11px] text-[var(--color-text-muted)]">Monthly Rent</p>
                                            <p className="text-base font-bold text-emerald-400 mt-0.5">
                                                ₹{Number(userRental.monthly_rent).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-[var(--color-surface-dark)] p-3.5 border border-[var(--color-border)]">
                                            <p className="text-[11px] text-[var(--color-text-muted)]">Rent Due Day</p>
                                            <p className="text-base font-bold text-white mt-0.5">
                                                {userRental.rent_due_day}th of every month
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-[var(--color-surface-dark)] p-3.5 border border-[var(--color-border)] col-span-2 sm:col-span-1">
                                            <p className="text-[11px] text-[var(--color-text-muted)]">Lease Duration</p>
                                            <p className="text-xs font-semibold text-white mt-1 truncate">
                                                {userRental.tenant?.lease_start || '01 Aug 2026'} – {userRental.tenant?.lease_end || '31 Jul 2027'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Owner / Landlord Contact Info */}
                                <div className="rounded-xl bg-[var(--color-surface-dark)] p-5 border border-[var(--color-border)] flex flex-col justify-between space-y-4">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            Owner / Landlord Details
                                        </p>
                                        <h4 className="text-sm font-bold text-white mt-2">
                                            {userRental.owner?.full_name || 'Property Owner'}
                                        </h4>
                                        <div className="text-xs text-[var(--color-text-muted)] space-y-1 mt-1.5">
                                            <p>📧 {userRental.owner?.email || 'owner@rentflow.com'}</p>
                                            <p>📞 {userRental.owner?.phone || '+91 9876543210'}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate('/chat')}
                                        className="w-full py-2 px-3 rounded-lg bg-[var(--color-primary)]/15 hover:bg-[var(--color-primary)] text-[var(--color-primary-light)] hover:text-white text-xs font-bold transition-all text-center"
                                    >
                                        💬 Message Landlord
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. Monthly Rent Payment Status Table */}
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-lg">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--color-border)] pb-4">
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                        <span>💳</span> Monthly Rent Payment Status
                                    </h2>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                        Calculated from rent amount, due dates, and verified payment records.
                                    </p>
                                </div>
                                <button
                                    onClick={() => navigate('/payments')}
                                    className="text-xs font-semibold text-[var(--color-primary-light)] hover:underline self-start sm:self-auto"
                                >
                                    View Full Payment History →
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                                            <th className="py-3 px-4">Month</th>
                                            <th className="py-3 px-4">Rent Amount</th>
                                            <th className="py-3 px-4">Due Date</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Payment Date</th>
                                            <th className="py-3 px-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]/50 text-slate-300">
                                        {userRental.payment_schedule.map((item) => (
                                            <tr key={item.month} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-3.5 px-4 font-bold text-white">{item.month_label}</td>
                                                <td className="py-3.5 px-4 font-semibold text-emerald-400">
                                                    ₹{Number(item.rent_amount).toLocaleString()}
                                                </td>
                                                <td className="py-3.5 px-4 font-medium">{item.due_date}</td>
                                                <td className="py-3.5 px-4">{getPaymentBadge(item.status)}</td>
                                                <td className="py-3.5 px-4 font-medium text-[var(--color-text-muted)]">
                                                    {item.payment_date || '—'}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    {item.status === 'PAID' ? (
                                                        <span className="text-emerald-400 font-semibold text-[11px]">✓ Settled</span>
                                                    ) : item.status === 'UPCOMING' ? (
                                                        <span className="text-[var(--color-text-muted)] text-[11px]">Upcoming</span>
                                                    ) : (
                                                        <button
                                                            onClick={() => handlePayRentNow(item)}
                                                            disabled={payingMonth === item.month}
                                                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-all shadow-sm"
                                                        >
                                                            {payingMonth === item.month ? 'Processing...' : 'Pay Rent Now'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* User Has No Active Rental */
                    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center space-y-4 shadow-lg">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary-light)] flex items-center justify-center text-3xl mx-auto">
                            🏡
                        </div>
                        <h2 className="text-xl font-bold text-white">No Active Rental Property</h2>
                        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
                            You have not rented any property yet. Browse our marketplace listings to find your ideal apartment, house, or room.
                        </p>
                        <div className="pt-2">
                            <button
                                onClick={() => navigate('/marketplace')}
                                className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-xs font-bold transition-all shadow-md"
                            >
                                + Browse Properties &amp; Apply
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. My Rental Applications Progress Section */}
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5 shadow-lg">
                    <div className="border-b border-[var(--color-border)] pb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                                <span>📋</span> My Rental Applications
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                Live status and ID verification progress of your rental applications.
                            </p>
                        </div>
                    </div>

                    {userRental.applications?.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">
                            You have not submitted any rental applications yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {userRental.applications.map((app) => {
                                const isApproved = ['APPROVED', 'ACTIVE'].includes((app.status || '').toUpperCase());
                                const isRejected = (app.status || '').toUpperCase() === 'REJECTED';
                                const isUnderReview = (app.status || '').toUpperCase() === 'UNDER REVIEW';

                                return (
                                    <div
                                        key={app.id}
                                        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5 space-y-4"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-white">
                                                    {app.property?.address || app.listing?.title || 'Target Property'}
                                                </h3>
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    Unit: {app.unit_number || 'Unit-1'} • Rent: ₹{Number(app.rent_amount).toLocaleString()}/month
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getApplicationStatusBadge(app.status)}
                                            </div>
                                        </div>

                                        {/* Step progress tracker */}
                                        <div className="grid grid-cols-4 gap-2 pt-2 text-center text-[10px] font-semibold">
                                            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                                1. Submitted ✓
                                            </div>
                                            <div className={`p-2 rounded-lg ${isUnderReview || isApproved || isRejected ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-400'}`}>
                                                2. Under Review {isUnderReview || isApproved || isRejected ? '✓' : '...'}
                                            </div>
                                            <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : isRejected ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : 'bg-white/5 text-slate-400'}`}>
                                                3. {isRejected ? 'Rejected ✕' : 'Approval' + (isApproved ? ' ✓' : '')}
                                            </div>
                                            <div className={`p-2 rounded-lg ${isApproved ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-400'}`}>
                                                4. Active Lease {isApproved ? '✓' : ''}
                                            </div>
                                        </div>

                                        {/* Rejection Alert + Resubmit Button */}
                                        {isRejected && (
                                            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                <div className="text-rose-300 space-y-0.5">
                                                    <p className="font-bold">Application Feedback / Rejection Reason:</p>
                                                    <p>{app.rejection_reason || 'Identity verification requirements not fulfilled.'}</p>
                                                </div>
                                                <button
                                                    onClick={() => setResubmitModalApp(app)}
                                                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-sm self-start sm:self-auto shrink-0"
                                                >
                                                    📄 Resubmit ID Proof
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Resubmit ID Proof Modal */}
                {resubmitModalApp && (
                    <Modal
                        isOpen={!!resubmitModalApp}
                        onClose={() => setResubmitModalApp(null)}
                        title="Resubmit Identity Document (ID Proof)"
                        size="sm"
                    >
                        <form onSubmit={handleResubmitId} className="space-y-4">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Upload a new government identity proof (Aadhaar, Passport, Driver's License, or Voter ID) in PDF, PNG, or JPG format.
                            </p>
                            <div>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={(e) => setResubmitFile(e.target.files?.[0] || null)}
                                    className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)]/15 file:text-[var(--color-primary-light)] hover:file:bg-[var(--color-primary)]/25 cursor-pointer"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setResubmitModalApp(null)}
                                    className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resubmitting || !resubmitFile}
                                    className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
                                >
                                    {resubmitting ? 'Uploading...' : 'Upload & Resubmit'}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}

                {/* Razorpay Online Rent Payment Modal */}
                {payModalItem && userRental.tenant && (
                    <PaymentModal
                        tenant={userRental.tenant}
                        amount={Number(payModalItem.rent_amount || userRental.monthly_rent || 0)}
                        onClose={() => setPayModalItem(null)}
                        onSuccess={async () => {
                            const label = payModalItem.month_label;
                            setPayModalItem(null);
                            toast.success(`Rent payment for ${label} recorded successfully!`);
                            await loadUserData();
                        }}
                    />
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // OWNER / ADMIN ROLE VIEW
    // ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">Owner &amp; Property Dashboard</h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">
                        Overview of your properties, tenant leases, revenue, and incoming applications
                    </p>
                </div>
                {stats.pendingRequestsCount > 0 && (
                    <button
                        onClick={() => navigate('/rental-requests')}
                        className="gold-glow-btn px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer animate-pulse"
                    >
                        <span>📬</span>
                        <span>{stats.pendingRequestsCount} Pending Rental Request{stats.pendingRequestsCount === 1 ? '' : 's'}</span>
                    </button>
                )}
            </div>

            {/* Quick Banner for Rental Requests */}
            {stats.pendingRequestsCount > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📝</span>
                        <div>
                            <h3 className="text-sm font-bold text-amber-300">Action Required: New Tenant Applications</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">
                                You have {stats.pendingRequestsCount} new tenant application{stats.pendingRequestsCount === 1 ? '' : 's'} waiting for ID verification and lease approval.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/rental-requests')}
                        className="gold-glow-btn px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                    >
                        Review Applications →
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 stagger">
                <StatCard icon="🏢" label="Properties" value={stats.properties} accent="var(--color-primary)" onClick={() => navigate('/properties')} />
                <StatCard icon="👥" label="Active Tenants" value={stats.tenants} accent="var(--color-accent)" onClick={() => navigate('/tenants')} />
                <StatCard icon="💰" label="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} accent="var(--color-success)" onClick={() => navigate('/payments')} />
                <StatCard icon="⏳" label="Pending Rent" value={`₹${stats.pendingAmount.toLocaleString()}`} accent="var(--color-danger)" onClick={() => navigate('/pending-rent')} />
                <StatCard icon="📈" label="Occupancy" value={`${stats.occupancy}%`} accent="var(--color-warning)" />
            </div>

            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                        <h2 className="text-lg font-semibold">Pending Rent for {stats.currentMonthLabel}</h2>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            {stats.pendingCount} active tenant{stats.pendingCount === 1 ? '' : 's'} still pending this month
                        </p>
                    </div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                        Total due: <span className="text-[var(--color-danger)] font-semibold">₹{stats.pendingAmount.toLocaleString()}</span>
                    </div>
                </div>

                {stats.pendingItems.length > 0 ? (
                    <div className="space-y-3">
                        {stats.pendingItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-3"
                            >
                                <div>
                                    <p className="font-medium">{item.tenantName}</p>
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        {item.propertyName}{item.unitNumber ? ` • Unit ${item.unitNumber}` : ''}
                                    </p>
                                </div>
                                <div className="flex gap-6 text-sm">
                                    <div>
                                        <p className="text-[var(--color-text-muted)]">Paid</p>
                                        <p className="font-medium text-[var(--color-success)]">₹{item.paidAmount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[var(--color-text-muted)]">Pending</p>
                                        <p className="font-medium text-[var(--color-danger)]">₹{item.pendingAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
                        No pending rent for {stats.currentMonthLabel}. All active tenants are marked paid.
                    </div>
                )}
            </div>

            {/* Quick-links panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                    <h2 className="text-base font-semibold mb-3">Owner Operations</h2>
                    <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                        <li className="flex items-center justify-between">
                            <span>Review incoming tenant rental requests</span>
                            <button onClick={() => navigate('/rental-requests')} className="text-xs text-[var(--color-primary-light)] font-bold">Open →</button>
                        </li>
                        <li className="flex items-center justify-between">
                            <span>Add new properties and manage units</span>
                            <button onClick={() => navigate('/properties')} className="text-xs text-[var(--color-primary-light)] font-bold">Open →</button>
                        </li>
                        <li className="flex items-center justify-between">
                            <span>Manage active tenants &amp; documents</span>
                            <button onClick={() => navigate('/tenants')} className="text-xs text-[var(--color-primary-light)] font-bold">Open →</button>
                        </li>
                    </ul>
                </div>

                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                    <h2 className="text-base font-semibold mb-3">Getting Started</h2>
                    <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                        <li className="flex items-start gap-2"><span className="text-[var(--color-primary)]">→</span> Add your properties with unit count &amp; rent amount</li>
                        <li className="flex items-start gap-2"><span className="text-[var(--color-primary)]">→</span> Verify applicant ID proofs before approving leases</li>
                        <li className="flex items-start gap-2"><span className="text-[var(--color-primary)]">→</span> Record monthly payments to track rent collection</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
