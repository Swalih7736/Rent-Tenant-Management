import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';
import { submitRentalApplication } from '../api';
import Modal from './Modal';

export default function ApplyRentalModal({ isOpen, onClose, property, listing, onSuccess }) {
    const { user } = useAuth();
    const toast = useToast();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [occupation, setOccupation] = useState('');
    const [monthlyIncome, setMonthlyIncome] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [leaseStart, setLeaseStart] = useState('');
    const [leaseEnd, setLeaseEnd] = useState('');
    const [unitNumber, setUnitNumber] = useState('Unit-1');
    const [rentDueDay, setRentDueDay] = useState(1);

    const [idProofFile, setIdProofFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);

    const propertyId = property?.id || listing?.property_id || listing?.id;
    const listingId = listing?.id;
    const rentAmount = property?.rent_amount || listing?.price || 0;
    const propertyTitle = property?.address || listing?.title || 'room';
    const localityText = listing?.city ? ` in ${listing.city}${listing.locality ? `, ${listing.locality}` : ''}` : '';

    useEffect(() => {
        if (isOpen && user) {
            setFullName(user.full_name || '');
            setEmail(user.email || '');
            setPhone(user.phone || '');
            setSubmittedSuccess(false);

            // Default lease dates: start today, end in 1 year
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            setLeaseStart(todayStr);

            const nextYear = new Date(today);
            nextYear.setFullYear(today.getFullYear() + 1);
            setLeaseEnd(nextYear.toISOString().split('T')[0]);
        }
    }, [isOpen, user]);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
        if (!allowed.includes(ext)) {
            toast.error('Please upload a valid identity verification document (PDF, PNG, JPG, or JPEG).');
            e.target.value = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be under 10 MB.');
            e.target.value = '';
            return;
        }

        setIdProofFile(file);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!idProofFile) {
            toast.error('Mandatory ID Proof is required. Please upload your identity document.');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (propertyId) formData.append('property_id', propertyId);
            if (listingId) formData.append('listing_id', listingId);
            formData.append('full_name', fullName);
            formData.append('email', email);
            formData.append('phone', phone);
            if (address) formData.append('address', address);
            if (dateOfBirth) formData.append('date_of_birth', dateOfBirth);
            if (occupation) formData.append('occupation', occupation);
            if (monthlyIncome) formData.append('monthly_income', monthlyIncome);
            if (emergencyName) formData.append('emergency_contact_name', emergencyName);
            if (emergencyPhone) formData.append('emergency_contact_phone', emergencyPhone);
            formData.append('lease_start', leaseStart);
            if (leaseEnd) formData.append('lease_end', leaseEnd);
            formData.append('unit_number', unitNumber || 'Unit-1');
            formData.append('rent_amount', rentAmount);
            formData.append('rent_due_day', rentDueDay);
            formData.append('id_proof', idProofFile);

            await submitRentalApplication(formData);

            setSubmittedSuccess(true);
            toast.success('Your rental application has been submitted and tenant record created successfully!');
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Rental application submit error:', err);
            toast.error(err?.response?.data?.detail || 'Failed to submit application.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Rental Application Form" size="lg">
            {submittedSuccess ? (
                <div className="py-6 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
                        ✓
                    </div>
                    <h3 className="text-xl font-bold text-white">Application Submitted &amp; Tenant Created!</h3>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto leading-relaxed">
                        Your rental application for <strong className="text-white">{propertyTitle}</strong> has been submitted. Your tenant lease is active and available in your dashboard.
                    </p>
                    <div className="pt-4 flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                window.location.href = '/';
                            }}
                            className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-sm font-semibold transition-all shadow-md"
                        >
                            Go to My Dashboard
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-light)]/80 text-[var(--color-text)] text-sm font-semibold"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Subtitle */}
                    <div className="text-xs text-[var(--color-text-muted)] -mt-1 mb-2">
                        Applying to rent: <strong className="text-white font-semibold">{propertyTitle}</strong>{localityText} (<span className="text-emerald-400 font-bold">${Number(rentAmount).toLocaleString()}/month</span>)
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        {/* Row 1 */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                FULL NAME *
                            </label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="e.g. John Doe"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                EMAIL ADDRESS *
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        {/* Row 2 */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                PHONE NUMBER *
                            </label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+91 9876543210"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                DATE OF BIRTH
                            </label>
                            <input
                                type="date"
                                value={dateOfBirth}
                                onChange={(e) => setDateOfBirth(e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        {/* Row 3 */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                OCCUPATION
                            </label>
                            <input
                                type="text"
                                value={occupation}
                                onChange={(e) => setOccupation(e.target.value)}
                                placeholder="e.g. Software Engineer"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                MONTHLY INCOME ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={monthlyIncome}
                                onChange={(e) => setMonthlyIncome(e.target.value)}
                                placeholder="e.g. 5000"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        {/* Row 4: Current Address textarea */}
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                CURRENT ADDRESS
                            </label>
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Enter your current residential address..."
                                rows={2}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-3 text-xs text-white focus:outline-none focus:border-[var(--color-primary)] resize-none"
                            />
                        </div>

                        {/* Row 5: Emergency Contacts */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                EMERGENCY CONTACT NAME
                            </label>
                            <input
                                type="text"
                                value={emergencyName}
                                onChange={(e) => setEmergencyName(e.target.value)}
                                placeholder="e.g. Parent / Spouse Name"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                EMERGENCY CONTACT PHONE
                            </label>
                            <input
                                type="tel"
                                value={emergencyPhone}
                                onChange={(e) => setEmergencyPhone(e.target.value)}
                                placeholder="+91 9876501234"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>

                        {/* Row 6: Lease dates */}
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                LEASE START DATE *
                            </label>
                            <input
                                type="date"
                                required
                                value={leaseStart}
                                onChange={(e) => setLeaseStart(e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                                EXPECTED LEASE END DATE *
                            </label>
                            <input
                                type="date"
                                required
                                value={leaseEnd}
                                onChange={(e) => setLeaseEnd(e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs text-white focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                    </div>

                    {/* Row 7: Upload ID Proof */}
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-4 space-y-2">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-white">
                            UPLOAD ID PROOF *
                        </label>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                            Please upload a valid identity verification document (PDF, PNG, JPG, or JPEG).
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                            <label className="cursor-pointer px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors border border-white/10 shrink-0">
                                Choose file
                                <input
                                    type="file"
                                    required
                                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </label>
                            <span className="text-xs text-[var(--color-text-muted)] truncate">
                                {idProofFile ? idProofFile.name : 'No file chosen'}
                            </span>
                            {idProofFile && (
                                <span className="text-xs text-emerald-400 font-bold ml-auto shrink-0">✓ Selected</span>
                            )}
                        </div>
                    </div>

                    {/* Actions Sticky Footer */}
                    <div className="sticky bottom-0 bg-[var(--color-surface)]/95 backdrop-blur-sm -mx-6 -mb-5 px-6 py-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)] mt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !idProofFile}
                            className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Submitting Application...</span>
                                </>
                            ) : (
                                <span>Submit Rental Application</span>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}
