import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteTenant, deleteTenantDocument, fetchProperties, fetchTenant, updateTenant, uploadTenantDocuments } from '../api';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { exportDetailsToPdf } from '../utils/exportPdf';

const emptyDocumentFiles = { agreement: null, proof: null };
const acceptedDocumentTypes = '.pdf,.png,.jpg,.jpeg,.webp';

function tenantToForm(tenant) {
    return {
        name: tenant.name,
        email: tenant.email || '',
        phone: tenant.phone || '',
        property_id: tenant.property_id,
        unit_number: tenant.unit_number || '',
        lease_start: tenant.lease_start || '',
        lease_end: tenant.lease_end || '',
        status: tenant.status,
        electric_meter_reading: tenant.electric_meter_reading || '',
        final_meter_reading: tenant.final_meter_reading || '',
        vacating_date: tenant.vacating_date || '',
        outstanding_dues: tenant.outstanding_dues != null ? String(tenant.outstanding_dues) : '',
    };
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

function DocumentCard({ label, fileName, fileUrl, canManage, onRemove }) {
    return (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
            <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-amber-400 font-bold">{label}</p>
            {fileUrl ? (
                <div className="space-y-3">
                    <p className="text-xs font-semibold text-white truncate">{fileName || 'Attached document'}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
                        >
                            Open document ↗
                        </a>
                        {canManage && (
                            <button
                                type="button"
                                onClick={onRemove}
                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-400 transition-colors hover:bg-rose-500/20 cursor-pointer"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-[var(--color-text-muted)]">No document attached yet.</p>
            )}
        </div>
    );
}

export default function TenantDetailPage() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { canManageProperties } = useAuth();
    const [tenant, setTenant] = useState(null);
    const [properties, setProperties] = useState([]);
    const [form, setForm] = useState(null);
    const [documentFiles, setDocumentFiles] = useState(emptyDocumentFiles);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [tenantData, propertiesData] = await Promise.all([
                fetchTenant(tenantId),
                fetchProperties(),
            ]);
            setTenant(tenantData);
            setProperties(propertiesData);
            setForm(tenantToForm(tenantData));
            setDocumentFiles(emptyDocumentFiles);
        } catch (err) {
            console.error(err);
            setTenant(null);
            toast.error('Failed to load tenant details.');
        } finally {
            setLoading(false);
        }
    }, [tenantId, toast]);

    useEffect(() => { load(); }, [load]);

    const property = useMemo(
        () => properties.find((item) => item.id === tenant?.property_id),
        [properties, tenant]
    );

    const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const setDocumentFile = (key, file) => setDocumentFiles((current) => ({ ...current, [key]: file || null }));

    const handleExport = async () => {
        try {
            await exportDetailsToPdf({
                title: `Tenant Profile - ${tenant.name}`,
                subtitle: `${property?.address || 'Unassigned property'} ${tenant.unit_number ? `• Unit ${tenant.unit_number}` : ''}`,
                sections: [
                    {
                        title: 'Profile',
                        fields: [
                            { label: 'Name', value: tenant.name },
                            { label: 'Status', value: tenant.status },
                            { label: 'Email', value: tenant.email || 'N/A' },
                            { label: 'Phone', value: tenant.phone || 'N/A' },
                        ],
                    },
                    {
                        title: 'Lease Information',
                        fields: [
                            { label: 'Property', value: property?.address || 'N/A' },
                            { label: 'Unit', value: tenant.unit_number || 'N/A' },
                            { label: 'Monthly Rent', value: property?.rent_amount ? `Rs ${Number(property.rent_amount).toLocaleString()}` : 'N/A' },
                            { label: 'Lease Start', value: tenant.lease_start || 'N/A' },
                            { label: 'Lease End', value: tenant.lease_end || 'N/A' },
                            { label: 'Rent Due Day', value: `Day ${tenant.rent_due_day || 1}` },
                        ],
                    },
                    {
                        title: 'Utility & Move Out',
                        fields: [
                            { label: 'Initial Meter', value: tenant.electric_meter_reading || 'N/A' },
                            { label: 'Final Meter', value: tenant.final_meter_reading || 'N/A' },
                            { label: 'Vacating Date', value: tenant.vacating_date || 'N/A' },
                            { label: 'Outstanding Dues', value: tenant.outstanding_dues != null ? `Rs ${Number(tenant.outstanding_dues).toLocaleString()}` : 'N/A' },
                        ],
                    },
                    {
                        title: 'Attached Documents',
                        fields: [
                            { label: 'Agreement', value: tenant.agreement_file_name || 'Not attached' },
                            { label: 'Proof Document', value: tenant.proof_file_name || 'Not attached' },
                        ],
                    },
                ],
            });
            toast.success('Tenant PDF downloaded.');
        } catch (err) {
            console.error(err);
            toast.error('Failed to export tenant PDF.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const data = {
                ...form,
                property_id: form.property_id || null,
                unit_number: form.unit_number || null,
                email: form.email || null,
                phone: form.phone || null,
                lease_start: form.lease_start || null,
                lease_end: form.lease_end || null,
                electric_meter_reading: form.electric_meter_reading || null,
                final_meter_reading: form.final_meter_reading || null,
                vacating_date: form.vacating_date || null,
                outstanding_dues: form.outstanding_dues === '' ? null : Number(form.outstanding_dues),
            };
            const updated = await updateTenant(tenantId, data);
            if (documentFiles.agreement || documentFiles.proof) {
                const uploadFormData = new FormData();
                if (documentFiles.agreement) uploadFormData.append('agreement', documentFiles.agreement);
                if (documentFiles.proof) uploadFormData.append('proof', documentFiles.proof);
                try {
                    const withDocs = await uploadTenantDocuments(tenantId, uploadFormData);
                    setTenant(withDocs);
                    setForm(tenantToForm(withDocs));
                    toast.success('Tenant and documents updated.');
                } catch (uploadError) {
                    console.error(uploadError);
                    setTenant(updated);
                    setForm(tenantToForm(updated));
                    toast.info('Tenant saved, but document upload failed.');
                }
            } else {
                setTenant(updated);
                setForm(tenantToForm(updated));
                toast.success('Tenant updated.');
            }
            setModalOpen(false);
            setDocumentFiles(emptyDocumentFiles);
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to update tenant.');
        }
    };

    const handleDelete = async () => {
        const confirmed = await toast.confirm('Delete this tenant record?', {
            title: 'Confirm deletion',
            confirmLabel: 'Delete',
        });
        if (!confirmed) return;
        try {
            await deleteTenant(tenantId);
            toast.success('Tenant deleted.');
            navigate('/tenants');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete tenant.');
        }
    };

    const handleRemoveDoc = async (documentKind) => {
        const label = documentKind === 'agreement' ? 'agreement document' : 'proof document';
        const confirmed = await toast.confirm(`Remove the attached ${label}?`, {
            title: 'Confirm removal',
            confirmLabel: 'Remove',
        });
        if (!confirmed) return;

        try {
            const updated = await deleteTenantDocument(tenantId, documentKind);
            setTenant(updated);
            setForm(tenantToForm(updated));
            toast.success('Document removed.');
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.detail || 'Failed to remove document.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    if (!tenant || !form) {
        return (
            <div className="space-y-6 animate-fade-in-up">
                <Link to="/tenants" className="inline-flex text-xs font-bold text-amber-400 hover:underline">
                    ← Back to tenants
                </Link>
                <div className="rounded-2xl border border-[var(--color-border)] glass-card p-6">
                    <h1 className="text-xl font-bold text-white">Tenant not found</h1>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">The tenant details could not be loaded.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative isolate space-y-6 animate-fade-in-up">
            <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_40%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_40%)]" />

            <div className="overflow-hidden rounded-[32px] border border-[var(--color-border)] glass-card shadow-2xl">
                <div className="flex flex-col gap-6 px-6 py-6 lg:px-8 lg:py-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <Link to="/tenants" className="mb-4 inline-flex text-xs font-bold text-amber-400 hover:underline">
                                ← Back to tenants
                            </Link>
                            <div className="flex items-start gap-4">
                                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-2xl font-black shadow-lg shadow-amber-500/25 ring-2 ring-amber-300/40">
                                    {tenant.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${tenant.status === 'active'
                                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                            : 'bg-white/5 border border-white/10 text-[var(--color-text-muted)]'
                                            }`}>
                                            {tenant.status}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--color-text-muted)] font-semibold">
                                            {property?.address || 'Unknown property'}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{tenant.name}</h1>
                                    <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--color-text-muted)]">
                                        A focused view of this tenant, lease terms, and linked property details so updates and decisions can happen from one place.
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
                            {canManageProperties && (
                                <>
                                <button
                                    onClick={() => { setDocumentFiles(emptyDocumentFiles); setModalOpen(true); }}
                                    className="gold-glow-btn rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer"
                                >
                                    Edit Tenant
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

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailStat label="Monthly Rent" value={`₹${Number(property?.rent_amount || 0).toLocaleString()}`} tone="accent" />
                        <DetailStat label="Unit" value={tenant.unit_number || 'Not assigned'} />
                        <DetailStat label="Lease End" value={tenant.lease_end || 'Ongoing'} />
                        <DetailStat label="Contact" value={tenant.phone || tenant.email || 'Not provided'} tone="success" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_.95fr]">
                <DetailBlock eyebrow="Tenant Profile" title="Contact and Lease" accent="rgba(245,158,11,.75)">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Email</p>
                            <p className="text-sm font-semibold text-white">{tenant.email || 'Not provided'}</p>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                            <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Phone</p>
                            <p className="text-sm font-semibold text-white">{tenant.phone || 'Not provided'}</p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Lease Timeline</p>
                                <h3 className="text-sm font-bold text-white tracking-tight">Current term</h3>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                {tenant.lease_start && tenant.lease_end ? 'Fixed lease' : 'Flexible'}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Unit</p>
                                <p className="text-sm font-bold text-white">{tenant.unit_number || 'Not assigned'}</p>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Lease Start</p>
                                <p className="text-sm font-bold text-white">{tenant.lease_start || 'Not set'}</p>
                            </div>
                            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                                <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Lease End</p>
                                <p className="text-sm font-bold text-white">{tenant.lease_end || 'Ongoing'}</p>
                            </div>
                        </div>
                    </div>
                </DetailBlock>

                <DetailBlock eyebrow="Verification" title="Attached Documents" accent="rgba(245,158,11,.75)">
                    <div className="space-y-4">
                        <DocumentCard
                            label="Lease Agreement"
                            fileName={tenant.agreement_file_name}
                            fileUrl={tenant.agreement_file_url}
                            canManage={canManageProperties}
                            onRemove={() => handleRemoveDoc('agreement')}
                        />
                        <DocumentCard
                            label="Proof of Identity"
                            fileName={tenant.proof_file_name}
                            fileUrl={tenant.proof_file_url}
                            canManage={canManageProperties}
                            onRemove={() => handleRemoveDoc('proof')}
                        />
                    </div>
                </DetailBlock>
            </div>

            {canManageProperties && (
                <Modal open={modalOpen} onClose={() => { setModalOpen(false); setDocumentFiles(emptyDocumentFiles); }} title="Edit Tenant Details">
                    <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Full Name</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => set('email', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Phone</label>
                            <input
                                value={form.phone}
                                onChange={(e) => set('phone', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Property</label>
                            <select
                                required
                                value={form.property_id}
                                onChange={(e) => set('property_id', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            >
                                <option value="">Select property...</option>
                                {properties.map((p) => (
                                    <option key={p.id} value={p.id}>{p.address}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Unit</label>
                            <input
                                value={form.unit_number}
                                onChange={(e) => set('unit_number', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Lease Start</label>
                            <input type="date" value={form.lease_start} onChange={(e) => set('lease_start', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Lease End</label>
                            <input type="date" value={form.lease_end} onChange={(e) => set('lease_end', e.target.value)}
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Status</label>
                        <select value={form.status} onChange={(e) => set('status', e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none">
                            <option value="active">Active</option>
                            <option value="past">Past</option>
                        </select>
                    </div>

                    {/* Vacating Section */}
                    <div className="border-t border-[var(--color-border)] pt-4 mt-2">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">⚡ Meter &amp; Vacating Details</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Initial Meter Reading</label>
                                <input value={form.electric_meter_reading} onChange={(e) => set('electric_meter_reading', e.target.value)}
                                    placeholder="e.g. 12345"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Final Meter Reading</label>
                                <input value={form.final_meter_reading} onChange={(e) => set('final_meter_reading', e.target.value)}
                                    placeholder="e.g. 12890"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Vacating Date</label>
                                <input type="date" value={form.vacating_date} onChange={(e) => set('vacating_date', e.target.value)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Outstanding Dues (₹)</label>
                                <input type="number" min="0" step="0.01" value={form.outstanding_dues} onChange={(e) => set('outstanding_dues', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3.5 py-2.5 text-xs text-white transition-colors focus:border-amber-400 focus:outline-none" />
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-[var(--color-border)] pt-4 mt-2">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-400">Documents</p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Agreement</label>
                                {tenant.agreement_file_url && (
                                    <a
                                        href={tenant.agreement_file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mb-2 inline-flex text-xs font-bold text-amber-400 hover:underline"
                                    >
                                        Current: {tenant.agreement_file_name || 'Open agreement'}
                                    </a>
                                )}
                                <input
                                    type="file"
                                    accept={acceptedDocumentTypes}
                                    onChange={(e) => setDocumentFile('agreement', e.target.files?.[0] || null)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-300"
                                />
                                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    {documentFiles.agreement ? documentFiles.agreement.name : 'Attach or replace agreement'}
                                </p>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Proof Document</label>
                                {tenant.proof_file_url && (
                                    <a
                                        href={tenant.proof_file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mb-2 inline-flex text-xs font-bold text-amber-400 hover:underline"
                                    >
                                        Current: {tenant.proof_file_name || 'Open proof'}
                                    </a>
                                )}
                                <input
                                    type="file"
                                    accept={acceptedDocumentTypes}
                                    onChange={(e) => setDocumentFile('proof', e.target.files?.[0] || null)}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-3 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-300"
                                />
                                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                                    {documentFiles.proof ? documentFiles.proof.name : 'Attach or replace proof document'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => { setModalOpen(false); setDocumentFiles(emptyDocumentFiles); }} className="px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-white cursor-pointer">Cancel</button>
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
