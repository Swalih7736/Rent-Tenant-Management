import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import { fetchOwnerRentalRequests, approveRentalApplication, rejectRentalApplication } from '../api';
import Modal from '../components/Modal';

export default function RentalRequestsPage() {
    const { user } = useAuth();
    const toast = useToast();

    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('ALL');

    // Detail / Verification Modal
    const [selectedApp, setSelectedApp] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Reject Modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Approve edit fields
    const [approvedUnit, setApprovedUnit] = useState('');
    const [approvedRent, setApprovedRent] = useState('');
    const [approvedDueDay, setApprovedDueDay] = useState(1);

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await fetchOwnerRentalRequests();
            setApplications(data);
        } catch (err) {
            console.error('Failed to load rental requests:', err);
            toast.error('Failed to load rental requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const handleOpenDetail = (app) => {
        setSelectedApp(app);
        setApprovedUnit(app.unit_number || 'Unit-1');
        setApprovedRent(app.rent_amount || '');
        setApprovedDueDay(app.rent_due_day || 1);
    };

    const handleApprove = async () => {
        if (!selectedApp) return;
        setActionLoading(true);
        try {
            const payload = {
                status: 'Approved',
                unit_number: approvedUnit,
                rent_amount: Number(approvedRent),
                rent_due_day: Number(approvedDueDay),
            };
            await approveRentalApplication(selectedApp.id, payload);
            toast.success(`Application for ${selectedApp.full_name} approved successfully! Active tenant record created.`);
            setSelectedApp(null);
            loadRequests();
        } catch (err) {
            console.error('Approve error:', err);
            toast.error(err?.response?.data?.detail || 'Failed to approve application.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedApp) return;
        setActionLoading(true);
        try {
            const payload = {
                status: 'Rejected',
                rejection_reason: rejectionReason || 'Application details did not satisfy property verification criteria.',
            };
            await rejectRentalApplication(selectedApp.id, payload);
            toast.success(`Application for ${selectedApp.full_name} has been rejected.`);
            setShowRejectModal(false);
            setRejectionReason('');
            setSelectedApp(null);
            loadRequests();
        } catch (err) {
            console.error('Reject error:', err);
            toast.error(err?.response?.data?.detail || 'Failed to reject application.');
        } finally {
            setActionLoading(false);
        }
    };

    const filtered = applications.filter((app) => {
        if (activeFilter === 'ALL') return true;
        return (app.status || '').toUpperCase() === activeFilter;
    });

    const getStatusBadge = (status) => {
        const s = (status || '').toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Approved</span>;
        }
        if (s === 'REJECTED') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20">Rejected</span>;
        }
        if (s === 'UNDER REVIEW') {
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/20">Under Review</span>;
        }
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20">Pending</span>;
    };

    const getIdBadge = (idStatus) => {
        const s = (idStatus || '').toLowerCase();
        if (s === 'verified') {
            return <span className="text-xs font-semibold text-emerald-400">✓ ID Verified</span>;
        }
        if (s === 'rejected') {
            return <span className="text-xs font-semibold text-rose-400">✕ ID Rejected</span>;
        }
        return <span className="text-xs font-semibold text-amber-400">📄 ID Submitted</span>;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Rental Applications & Verification</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Review incoming tenant applications, verify identity documents, and approve leases.
                    </p>
                </div>
                <button
                    onClick={loadRequests}
                    className="px-4 py-2 rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-light)]/80 text-white text-xs font-semibold transition-all self-start sm:self-auto"
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveFilter(tab)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            activeFilter === tab
                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                : 'bg-[var(--color-surface-dark)] text-[var(--color-text-muted)] hover:text-white'
                        }`}
                    >
                        {tab === 'ALL' ? `All Requests (${applications.length})` : tab}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
                    <div className="text-4xl mb-3">📬</div>
                    <h3 className="text-base font-bold text-white">No Rental Applications Found</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {activeFilter === 'ALL'
                            ? 'You currently have no incoming rental applications for your properties.'
                            : `No rental applications with status "${activeFilter}".`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filtered.map((app) => (
                        <div
                            key={app.id}
                            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                        >
                            <div className="space-y-2 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                    <h3 className="text-base font-bold text-white">{app.full_name}</h3>
                                    {getStatusBadge(app.status)}
                                    {getIdBadge(app.id_verification_status)}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 text-xs text-[var(--color-text-muted)]">
                                    <div>
                                        <span className="font-semibold text-slate-300">Property:</span> {app.property?.address || app.listing?.title || 'Target Property'}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-300">Preferred Unit:</span> {app.unit_number || 'Unit-1'}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-300">Monthly Rent:</span> ₹{Number(app.rent_amount).toLocaleString()}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-300">Email:</span> {app.email}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-300">Phone:</span> {app.phone}
                                    </div>
                                    <div>
                                        <span className="font-semibold text-slate-300">Applied on:</span> {new Date(app.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {app.rejection_reason && (
                                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-xs text-rose-300">
                                        <strong>Rejection Reason:</strong> {app.rejection_reason}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 self-end lg:self-center">
                                <button
                                    onClick={() => handleOpenDetail(app)}
                                    className="px-4 py-2.5 rounded-xl bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] text-[var(--color-primary-light)] hover:text-white text-xs font-bold transition-all"
                                >
                                    View Details & Verify ID
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Application Detail & Verification Modal */}
            {selectedApp && (
                <Modal
                    isOpen={!!selectedApp}
                    onClose={() => setSelectedApp(null)}
                    title={`Application Verification — ${selectedApp.full_name}`}
                    size="lg"
                >
                    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
                        {/* Status bar */}
                        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)]">
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)]">Application Status</p>
                                <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-[var(--color-text-muted)]">Identity Document</p>
                                <div className="mt-1">{getIdBadge(selectedApp.id_verification_status)}</div>
                            </div>
                        </div>

                        {/* Applicant full details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] space-y-1.5">
                                <p className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Contact Info</p>
                                <p><span className="text-[var(--color-text-muted)]">Full Name:</span> <strong className="text-white">{selectedApp.full_name}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Email:</span> <strong className="text-white">{selectedApp.email}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Phone:</span> <strong className="text-white">{selectedApp.phone}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">DOB:</span> <strong className="text-white">{selectedApp.date_of_birth || 'Not specified'}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Current Address:</span> <strong className="text-white">{selectedApp.address || 'Not specified'}</strong></p>
                            </div>

                            <div className="p-3 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] space-y-1.5">
                                <p className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Employment & Emergency</p>
                                <p><span className="text-[var(--color-text-muted)]">Occupation:</span> <strong className="text-white">{selectedApp.occupation || 'Not specified'}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Monthly Income:</span> <strong className="text-emerald-400">₹{Number(selectedApp.monthly_income || 0).toLocaleString()}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Emergency Contact:</span> <strong className="text-white">{selectedApp.emergency_contact_name || 'N/A'}</strong></p>
                                <p><span className="text-[var(--color-text-muted)]">Emergency Phone:</span> <strong className="text-white">{selectedApp.emergency_contact_phone || 'N/A'}</strong></p>
                            </div>
                        </div>

                        {/* ID Proof Document Section */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Uploaded Identity Proof (ID)</h4>
                                <a
                                    href={selectedApp.id_proof_file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1 rounded-lg bg-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] text-[var(--color-primary-light)] hover:text-white text-xs font-bold transition-all"
                                >
                                    ↗ Open Document in New Tab
                                </a>
                            </div>

                            {selectedApp.id_proof_file_url?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                                <div className="max-h-64 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-black/50">
                                    <img
                                        src={selectedApp.id_proof_file_url}
                                        alt="ID Proof Document"
                                        className="max-h-64 object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-black/40 border border-white/10 flex items-center gap-3">
                                    <span className="text-3xl">📄</span>
                                    <div>
                                        <p className="text-xs font-bold text-white">{selectedApp.id_proof_file_name}</p>
                                        <p className="text-[10px] text-[var(--color-text-muted)]">PDF Identity Verification Document</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Lease Assignment Settings (Editable prior to approval) */}
                        {selectedApp.status?.toUpperCase() === 'PENDING' && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Lease Terms Confirmation</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-white mb-1">Assign Unit/Room</label>
                                        <input
                                            type="text"
                                            value={approvedUnit}
                                            onChange={(e) => setApprovedUnit(e.target.value)}
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-white mb-1">Monthly Rent (₹)</label>
                                        <input
                                            type="number"
                                            value={approvedRent}
                                            onChange={(e) => setApprovedRent(e.target.value)}
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-white mb-1">Rent Due Day of Month</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="31"
                                            value={approvedDueDay}
                                            onChange={(e) => setApprovedDueDay(e.target.value)}
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-1.5 text-xs text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                            <button
                                type="button"
                                onClick={() => setSelectedApp(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
                            >
                                Close
                            </button>

                            {selectedApp.status?.toUpperCase() === 'PENDING' && (
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={actionLoading}
                                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold transition-all"
                                    >
                                        Reject Application
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
                                    >
                                        {actionLoading ? 'Processing...' : '✓ Approve & Create Tenant'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Rejection Reason Modal */}
            {showRejectModal && (
                <Modal
                    isOpen={showRejectModal}
                    onClose={() => setShowRejectModal(false)}
                    title="Reject Rental Application"
                    size="sm"
                >
                    <div className="space-y-4">
                        <p className="text-xs text-[var(--color-text-muted)]">
                            Please provide an optional reason for rejecting the application of <strong>{selectedApp?.full_name}</strong>. The applicant will be able to see this feedback.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold text-white mb-1">Rejection Reason</label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g. Incomplete ID document / Income criteria not met..."
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-3 text-xs text-white focus:outline-none focus:border-rose-500 h-24 resize-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRejectModal(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={actionLoading}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
                            >
                                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
