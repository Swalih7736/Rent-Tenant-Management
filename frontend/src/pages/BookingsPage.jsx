import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import { fetchBookings, updateBookingStatus } from '../api';

export default function BookingsPage() {
    const { user } = useAuth();
    const toast = useToast();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const list = await fetchBookings();
                setBookings(list);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load bookings.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [toast]);

    const handleStatusUpdate = async (bookingId, newStatus) => {
        try {
            await updateBookingStatus(bookingId, { status: newStatus });
            toast.success(`Booking ${newStatus.toLowerCase()}ed successfully!`);
            // Refresh
            const list = await fetchBookings();
            setBookings(list);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update booking status.');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="border-b border-[var(--color-border)]/60 pb-5">
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                    Walkthrough <span className="gold-gradient-text">Bookings</span>
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Manage scheduled property walkthroughs and in-person visit appointments.
                </p>
            </div>

            {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                </div>
            ) : bookings.length === 0 ? (
                <div className="text-center py-16 glass-card rounded-2xl">
                    <div className="text-4xl mb-3">📅</div>
                    <h3 className="text-lg font-bold text-white">No Appointments Found</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">No walkthrough bookings are currently scheduled.</p>
                </div>
            ) : (
                <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/80">
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Listing</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Date & Slot</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Participant</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]/40">
                                {bookings.map((bk) => {
                                    const isSeller = user?.id === bk.seller_id;
                                    const otherPerson = isSeller ? bk.buyer : bk.seller;
                                    const otherName = otherPerson?.full_name || otherPerson?.email || 'Unknown';
                                    const otherPhone = otherPerson?.phone || 'No phone provided';

                                    return (
                                        <tr key={bk.id} className="hover:bg-amber-500/[0.02] transition-colors text-sm">
                                            <td className="p-4">
                                                <div className="font-bold text-white">{bk.listing?.title || 'Property Listing'}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{bk.listing?.city || 'Location unavailable'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    {new Date(bk.preferred_date).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-[var(--color-primary)] font-semibold uppercase tracking-wider mt-0.5">
                                                    {bk.preferred_slot}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-medium text-white">{otherName}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{otherPhone}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                    bk.status === 'PENDING' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                                                    bk.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                                    bk.status === 'REJECTED' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
                                                    'bg-white/5 text-[var(--color-text-muted)] border border-white/10'
                                                }`}>
                                                    {bk.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                {bk.status === 'PENDING' && (
                                                    <div className="flex justify-end gap-2">
                                                        {isSeller ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(bk.id, 'APPROVED')}
                                                                    className="bg-emerald-600 hover:bg-emerald-500 font-bold py-1.5 px-3.5 rounded-xl text-xs text-white transition-all shadow-sm"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(bk.id, 'REJECTED')}
                                                                    className="bg-rose-600 hover:bg-rose-500 font-bold py-1.5 px-3.5 rounded-xl text-xs text-white transition-all shadow-sm"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleStatusUpdate(bk.id, 'CANCELLED')}
                                                                className="glass-card hover:bg-white/10 font-bold py-1.5 px-3.5 rounded-xl text-xs text-[var(--color-text-muted)] hover:text-white transition-all"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
