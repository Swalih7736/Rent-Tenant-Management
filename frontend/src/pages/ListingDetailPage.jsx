import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import {
    fetchMarketplaceListing,
    createConversation,
    sendMessage,
    createBooking,
    createCheckoutOrder,
    triggerPaymentWebhook,
} from '../api';
import ApplyRentalModal from '../components/ApplyRentalModal';

export default function ListingDetailPage() {

    const { listingId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAuth();

    const [listing, setListing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeImage, setActiveImage] = useState('');

    // Apply Rental modal
    const [showApplyModal, setShowApplyModal] = useState(false);

    // Offer modal
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [offerAmount, setOfferAmount] = useState('');
    const [offerSubmitting, setOfferSubmitting] = useState(false);


    // Booking modal
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingSlot, setBookingSlot] = useState('MORNING');
    const [bookingSubmitting, setBookingSubmitting] = useState(false);

    // Checkout state
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchMarketplaceListing(listingId);
                setListing(data);
                if (data.images && data.images.length > 0) {
                    setActiveImage(data.images[0]);
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load listing details.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [listingId, toast]);

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl">
                <p className="text-sm text-[var(--color-text-muted)]">Listing not found.</p>
            </div>
        );
    }

    const isOwnListing = user?.id === listing.seller_id;

    const handleChat = async () => {
        try {
            const conv = await createConversation({ listing_id: listingId });
            navigate('/chat', { state: { selectedConvId: conv.id } });
        } catch (err) {
            console.error(err);
            toast.error('Failed to initiate conversation.');
        }
    };

    const handleOfferSubmit = async (e) => {
        e.preventDefault();
        setOfferSubmitting(true);
        try {
            const conv = await createConversation({ listing_id: listingId });
            await sendMessage(conv.id, {
                message: `Hi, I would like to make an offer of $${Number(offerAmount).toLocaleString()} for this item.`,
                offer_amount: Number(offerAmount),
            });
            toast.success('Offer sent successfully via chat!');
            setShowOfferModal(false);
            navigate('/chat', { state: { selectedConvId: conv.id } });
        } catch (err) {
            console.error(err);
            toast.error('Failed to submit offer.');
        } finally {
            setOfferSubmitting(false);
        }
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setBookingSubmitting(true);
        try {
            await createBooking({
                listing_id: listingId,
                preferred_date: bookingDate,
                preferred_slot: bookingSlot,
            });
            toast.success('Site walkthrough visit booked successfully!');
            setShowBookingModal(false);
            navigate('/bookings');
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to book walkthrough.');
        } finally {
            setBookingSubmitting(false);
        }
    };

    const handleCheckout = async () => {
        setCheckoutLoading(true);
        try {
            const tType = (listing.listing_type || '').toUpperCase() === 'SALE' ? 'BUY' : 'RENT';
            // 1. Create order
            const order = await createCheckoutOrder({
                item_type: 'LISTING',
                item_id: listingId,
                transaction_type: tType,
                amount: Number(listing.price),
            });

            toast.info('Simulating payment checkout flow...');

            // 2. Simulate success payment response
            setTimeout(async () => {
                try {
                    await triggerPaymentWebhook({
                        order_id: order.id,
                        payment_id: `pay_${Math.random().toString(36).substr(2, 9)}`,
                        status: 'success',
                    });
                    toast.success('Payment completed! Listing status updated.');
                    // Reload listing details
                    const updated = await fetchMarketplaceListing(listingId);
                    setListing(updated);
                } catch (err) {
                    console.error(err);
                    toast.error('Failed to complete automated status updates.');
                } finally {
                    setCheckoutLoading(false);
                }
            }, 1500);

        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to initiate checkout.');
            setCheckoutLoading(false);
        }
    };


    return (
        <div className="space-y-6">
            {/* Back to Marketplace */}
            <div>
                <button
                    onClick={() => navigate('/marketplace')}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                    ← Back to Marketplace
                </button>
            </div>

            {/* Layout grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Images column */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="h-96 w-full rounded-3xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden shadow-2xl">
                        {activeImage ? (
                            <img src={activeImage} alt={listing.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-7xl">🏢</div>
                        )}
                    </div>
                    {listing.images && listing.images.length > 1 && (
                        <div className="flex gap-2.5 overflow-x-auto pb-1">
                            {listing.images.map((img, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveImage(img)}
                                    className={`h-16 w-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                                        activeImage === img ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                >
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details column */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-5">
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg shadow-sm ${
                                listing.listing_type === 'RENT' ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300' : 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300'
                            }`}>
                                {listing.listing_type === 'RENT' ? 'For Rent' : 'For Sale'}
                            </span>
                            <span className={`text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-1 rounded-lg ${
                                listing.status === 'ACTIVE'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}>
                                {listing.status}
                            </span>
                        </div>

                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight text-white">{listing.title}</h1>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1.5">{listing.city}{listing.locality ? `, ${listing.locality}` : ''}</p>
                        </div>

                        <div className="text-3xl font-black text-amber-400">
                            ${listing.price.toLocaleString()}
                            {listing.listing_type === 'RENT' && <span className="text-xs font-normal text-[var(--color-text-muted)]">/{listing.rent_frequency}</span>}
                        </div>

                        <hr className="border-[var(--color-border)]" />

                        <div className="space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Description</h3>
                            <p className="text-xs leading-relaxed text-slate-200">{listing.description || 'No description provided.'}</p>
                        </div>

                        <hr className="border-[var(--color-border)]" />

                        {/* Actions */}
                        {listing.status === 'ACTIVE' && (
                            <div className="space-y-3 pt-2">
                                {isOwnListing ? (
                                    <div className="text-xs text-center font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 py-3 px-4 rounded-xl">
                                        This is your listing. You can edit this item's info or manage offers via chat.
                                    </div>
                                ) : (
                                    <>
                                        {listing.listing_type === 'RENT' ? (
                                            <button
                                                onClick={() => setShowApplyModal(true)}
                                                className="w-full rounded-xl gold-glow-btn py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <span>📄 Apply to Rent</span>
                                            </button>
                                        ) : (

                                            <button
                                                onClick={handleCheckout}
                                                disabled={checkoutLoading}
                                                className="w-full rounded-xl gold-glow-btn py-3 text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                {checkoutLoading ? (
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                                                ) : (
                                                    <>💳 Buy Now</>
                                                )}
                                            </button>
                                        )}

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <button
                                                onClick={handleChat}
                                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] hover:border-amber-400 hover:text-amber-400 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                                            >
                                                💬 Contact Seller
                                            </button>
                                            <button
                                                onClick={() => setShowOfferModal(true)}
                                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] hover:border-amber-400 hover:text-amber-400 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
                                            >
                                                🤝 Make an Offer
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowBookingModal(true)}
                                            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 py-2.5 text-xs font-bold text-amber-300 transition-all cursor-pointer"
                                        >
                                            📅 Schedule Site Walkthrough
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Offer Modal */}
            {showOfferModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
                    <div className="bg-[var(--color-surface)] border border-amber-500/20 w-full max-w-sm rounded-3xl shadow-2xl shadow-black/80 overflow-hidden animate-fade-in-up">
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-dark)]/40">
                            <h2 className="text-sm font-bold text-white">Make a Counter Offer</h2>
                            <button onClick={() => setShowOfferModal(false)} className="text-[var(--color-text-muted)] hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleOfferSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--color-text-muted)] font-semibold">Propose Price ($)</label>
                                <input
                                    type="number"
                                    required
                                    value={offerAmount}
                                    onChange={(e) => setOfferAmount(e.target.value)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                                    placeholder={listing.price.toString()}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={offerSubmitting}
                                className="w-full rounded-xl gold-glow-btn py-2.5 text-xs font-bold disabled:opacity-60 cursor-pointer"
                            >
                                {offerSubmitting ? 'Sending...' : 'Submit Counter Offer'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Visit Booking Modal */}
            {showBookingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
                    <div className="bg-[var(--color-surface)] border border-amber-500/20 w-full max-w-sm rounded-3xl shadow-2xl shadow-black/80 overflow-hidden animate-fade-in-up">
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-dark)]/40">
                            <h2 className="text-sm font-bold text-white">Book Site Walkthrough</h2>
                            <button onClick={() => setShowBookingModal(false)} className="text-[var(--color-text-muted)] hover:text-white cursor-pointer">
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleBookingSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--color-text-muted)] font-semibold">Preferred Date</label>
                                <input
                                    type="date"
                                    required
                                    value={bookingDate}
                                    onChange={(e) => setBookingDate(e.target.value)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--color-text-muted)] font-semibold">Time Slot</label>
                                <select
                                    value={bookingSlot}
                                    onChange={(e) => setBookingSlot(e.target.value)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                                >
                                    <option value="MORNING">Morning (9 AM - 12 PM)</option>
                                    <option value="AFTERNOON">Afternoon (12 PM - 4 PM)</option>
                                    <option value="EVENING">Evening (4 PM - 7 PM)</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                disabled={bookingSubmitting}
                                className="w-full rounded-xl gold-glow-btn py-2.5 text-xs font-bold disabled:opacity-60 cursor-pointer"
                            >
                                {bookingSubmitting ? 'Booking...' : 'Book Walkthrough'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Apply for Rent Modal */}
            <ApplyRentalModal
                isOpen={showApplyModal}
                onClose={() => setShowApplyModal(false)}
                listing={listing}
            />
        </div>
    );
}

