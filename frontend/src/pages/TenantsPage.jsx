import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTenants, fetchProperties, createTenant, uploadTenantDocuments } from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

const emptyForm = { name: '', email: '', phone: '', property_id: '', unit_number: '', lease_start: '', lease_end: '', status: 'active', electric_meter_reading: '', rent_due_day: '1' };
const emptyDocumentFiles = { agreement: null, proof: null };
const acceptedDocumentTypes = '.pdf,.png,.jpg,.jpeg,.webp';

export default function TenantsPage() {
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [documentFiles, setDocumentFiles] = useState(emptyDocumentFiles);
    const [filterProp, setFilterProp] = useState('');
    const { canManageProperties } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [t, p] = await Promise.all([fetchTenants(filterProp ? { property_id: filterProp } : {}), fetchProperties()]);
            setTenants(t);
            setProperties(p);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load tenants.');
        }
        finally { setLoading(false); }
    }, [filterProp, toast]);

    useEffect(() => { load(); }, [load]);

    const propMap = Object.fromEntries(properties.map(p => [p.id, p.address]));

    const openNew = () => {
        setForm(emptyForm);
        setDocumentFiles(emptyDocumentFiles);
        setModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = { ...form };
        if (!data.email) data.email = null;
        if (!data.phone) data.phone = null;
        if (!data.lease_start) data.lease_start = null;
        if (!data.lease_end) data.lease_end = null;
        if (!data.unit_number) data.unit_number = null;
        if (!data.electric_meter_reading) data.electric_meter_reading = null;
        data.rent_due_day = data.rent_due_day ? Number(data.rent_due_day) : 1;
        try {
            const createdTenant = await createTenant(data);
            if (documentFiles.agreement || documentFiles.proof) {
                const uploadFormData = new FormData();
                if (documentFiles.agreement) uploadFormData.append('agreement', documentFiles.agreement);
                if (documentFiles.proof) uploadFormData.append('proof', documentFiles.proof);
                try {
                    await uploadTenantDocuments(createdTenant.id, uploadFormData);
                    toast.success('Tenant added with documents.');
                } catch (uploadError) {
                    console.error(uploadError);
                    toast.info('Tenant added, but document upload failed. You can attach them from the tenant detail page.');
                }
            } else {
                toast.success('Tenant added.');
            }
            setModalOpen(false);
            setForm(emptyForm);
            setDocumentFiles(emptyDocumentFiles);
            load();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to save tenant.');
        }
    };

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const setDocumentFile = (key, file) => setDocumentFiles((current) => ({ ...current, [key]: file || null }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">Tenants Management</h1>
                    <p className="text-[var(--color-text-muted)] text-sm mt-1">{tenants.length} registered tenant{tenants.length === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filterProp} onChange={e => setFilterProp(e.target.value)}
                        className="px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors"
                    >
                        <option value="">All Properties</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
                    </select>
                    {canManageProperties && (
                        <button
                            onClick={openNew}
                            className="gold-glow-btn px-4 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer"
                        >
                            + Add Tenant
                        </button>
                    )}
                </div>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
                {tenants.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => navigate(`/tenants/${t.id}`)}
                        className="glass-card rounded-2xl p-5 transition-all duration-300 group text-left cursor-pointer hover:-translate-y-1 hover:border-amber-500/40"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300/40">
                                    {t.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors truncate">{t.name}</p>
                                    <p className="text-xs text-[var(--color-text-muted)] truncate">{propMap[t.property_id] || 'Unknown'}</p>
                                </div>
                            </div>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${t.status === 'active'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-white/5 text-[var(--color-text-muted)] border border-white/10'
                                }`}>
                                {t.status}
                            </span>
                        </div>
                        <div className="space-y-1.5 text-xs text-[var(--color-text-muted)] mb-4 bg-[var(--color-surface-dark)]/50 p-3 rounded-xl border border-[var(--color-border)]/50">
                            {t.email && <p className="truncate">📧 {t.email}</p>}
                            {t.phone && <p>📞 {t.phone}</p>}
                            {t.lease_start && <p>📅 {t.lease_start} → {t.lease_end || 'ongoing'}</p>}
                        </div>
                        <div className="flex justify-end">
                            <span className="text-xs text-amber-400 font-bold group-hover:underline">View details →</span>
                        </div>
                    </button>
                ))}
                {tenants.length === 0 && (
                    <div className="col-span-full text-center py-16 glass-card rounded-2xl text-[var(--color-text-muted)] text-xs">
                        No tenants found matching criteria. Click "+ Add Tenant" above to add one.
                    </div>
                )}
            </div>

            {/* Modal */}
            {canManageProperties && (
                <Modal open={modalOpen} onClose={() => { setModalOpen(false); setDocumentFiles(emptyDocumentFiles); }} title="Add New Tenant" maxWidth="max-w-3xl">
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Full Name *</label>
                        <input required value={form.name} onChange={e => set('name', e.target.value)}
                            placeholder="e.g. Alexander Wright"
                            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Email Address</label>
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                placeholder="tenant@example.com"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Phone Number</label>
                            <input value={form.phone} onChange={e => set('phone', e.target.value)}
                                placeholder="+91 9876543210"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Assigned Property *</label>
                            <select required value={form.property_id} onChange={e => set('property_id', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                                <option value="">Select property…</option>
                                {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Unit / Room #</label>
                            <input value={form.unit_number} onChange={e => set('unit_number', e.target.value)}
                                placeholder="e.g. Unit 4B"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Lease Start</label>
                            <input type="date" value={form.lease_start} onChange={e => set('lease_start', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Lease End</label>
                            <input type="date" value={form.lease_end} onChange={e => set('lease_end', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Status</label>
                        <select value={form.status} onChange={e => set('status', e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                            <option value="active">Active</option>
                            <option value="past">Past</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Electric Meter Reading</label>
                            <input value={form.electric_meter_reading} onChange={e => set('electric_meter_reading', e.target.value)}
                                placeholder="e.g. 12345"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Rent Due Day</label>
                            <select value={form.rent_due_day} onChange={e => set('rent_due_day', e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-dark)] border border-[var(--color-border)] rounded-xl text-xs text-white focus:outline-none focus:border-amber-400 transition-colors">
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                    <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of every month</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="border-t border-[var(--color-border)] pt-4">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-400">Documents</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Lease Agreement</label>
                                <input
                                    type="file"
                                    accept={acceptedDocumentTypes}
                                    onChange={e => setDocumentFile('agreement', e.target.files?.[0] || null)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-300"
                                />
                                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    {documentFiles.agreement ? documentFiles.agreement.name : 'PDF or image up to 10 MB'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Identity Proof Document</label>
                                <input
                                    type="file"
                                    accept={acceptedDocumentTypes}
                                    onChange={e => setDocumentFile('proof', e.target.files?.[0] || null)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-300"
                                />
                                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    {documentFiles.proof ? documentFiles.proof.name : 'ID proof or supporting document'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => { setModalOpen(false); setDocumentFiles(emptyDocumentFiles); }} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer">Cancel</button>
                        <button type="submit" className="gold-glow-btn px-5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer">Add Tenant</button>
                    </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
