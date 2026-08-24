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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Walkthrough Bookings</h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Manage scheduled walkthrough appointments for rent and sales properties.</p>
            </div>

            {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                </div>
            ) : bookings.length === 0 ? (
                <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl">
                    <p className="text-sm text-[var(--color-text-muted)]">No bookings scheduled yet.</p>
                </div>
            ) : (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/40">
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Listing</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Date & Slot</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Other Party</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {bookings.map((bk) => {
                                    const isSeller = user.id === bk.seller_id;
                                    const otherPerson = isSeller ? bk.buyer : bk.seller;
                                    const otherName = otherPerson?.full_name || otherPerson?.email || 'Unknown';
                                    const otherPhone = otherPerson?.phone || 'No phone';

                                    return (
                                        <tr key={bk.id} className="hover:bg-white/[0.01] transition-colors text-sm">
                                            <td className="p-4">
                                                <div className="font-semibold text-white">{bk.listing?.title || 'Listing Detail'}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{bk.listing?.city}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white">{new Date(bk.preferred_date).toLocaleDateString()}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">{bk.preferred_slot}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-white">{otherName}</div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{otherPhone}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                    bk.status === 'PENDING' ? 'bg-blue-500/10 text-blue-400' :
                                                    bk.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    bk.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-white/5 text-[var(--color-text-muted)]'
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
                                                                    className="bg-emerald-500 hover:bg-emerald-600 font-bold py-1.5 px-3 rounded-xl text-xs text-white transition-colors"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(bk.id, 'REJECTED')}
                                                                    className="bg-red-500 hover:bg-red-600 font-bold py-1.5 px-3 rounded-xl text-xs text-white transition-colors"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleStatusUpdate(bk.id, 'CANCELLED')}
                                                                className="bg-white/10 hover:bg-white/15 border border-[var(--color-border)] font-bold py-1.5 px-3 rounded-xl text-xs text-white transition-colors"
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
