import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import {
    fetchMarketplaceCategories,
    fetchMarketplaceListings,
    createMarketplaceListing,
    uploadMarketplaceImages,
} from '../api';


export default function MarketplacePage() {
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [listings, setListings] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [city, setCity] = useState('');
    const [listingType, setListingType] = useState(''); // 'RENT', 'SALE'
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [newListing, setNewListing] = useState({
        title: '',
        description: '',
        category_id: '',
        listing_type: 'RENT',
        price: '',
        rent_frequency: 'monthly',
        city: '',
        locality: '',
    });

    const isSeller = ['admin', 'manager', 'owner'].includes(user?.role?.toLowerCase() || '');

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const cats = await fetchMarketplaceCategories();
                setCategories(cats);
                const list = await fetchMarketplaceListings();
                setListings(list);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load marketplace data.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [toast]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const params = {};
            if (selectedCategory) params.category_id = selectedCategory;
            if (city) params.city = city;
            if (listingType) params.listing_type = listingType;
            if (minPrice) params.min_price = Number(minPrice);
            if (maxPrice) params.max_price = Number(maxPrice);
            const list = await fetchMarketplaceListings(params);
            setListings(list);
        } catch (err) {
            console.error(err);
            toast.error('Failed to filter listings.');
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryClick = (catId) => {
        const next = selectedCategory === catId ? null : catId;
        setSelectedCategory(next);
        // Trigger filter immediately
        setLoading(true);
        fetchMarketplaceListings({
            category_id: next || undefined,
            city: city || undefined,
            listing_type: listingType || undefined,
            min_price: minPrice ? Number(minPrice) : undefined,
            max_price: maxPrice ? Number(maxPrice) : undefined,
        }).then(setListings).catch(() => toast.error('Failed to filter.')).finally(() => setLoading(false));
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        setUploading(true);
        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
            });
            const urls = await uploadMarketplaceImages(formData);
            setUploadedImages(prev => [...prev, ...urls]);
            toast.success('Images uploaded successfully!');
        } catch (err) {
            console.error(err);
            toast.error('Failed to upload images.');
        } finally {
            setUploading(false);
        }
    };

    const handleCreateListing = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createMarketplaceListing({
                ...newListing,
                price: Number(newListing.price),
                images: uploadedImages,
                category_id: newListing.category_id || null,
                locality: newListing.locality || null,
                description: newListing.description || null,
            });
            toast.success('Listing created successfully!');
            setShowModal(false);
            setNewListing({
                title: '',
                description: '',
                category_id: '',
                listing_type: 'RENT',
                price: '',
                rent_frequency: 'monthly',
                city: '',
                locality: '',
            });
            setUploadedImages([]);
            // Reload
            const list = await fetchMarketplaceListings();
            setListings(list);
        } catch (err) {
            console.error(err);
            const detail = err?.response?.data?.detail;
            const msg = Array.isArray(detail)
                ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
                : (typeof detail === 'string' ? detail : 'Failed to create listing.');
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-border)] pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-white gold-gradient-text">Marketplace & Classifieds</h1>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">Browse luxury properties, apartments, and exclusive rental suites.</p>
                </div>
                {isSeller && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="gold-glow-btn rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-md self-start sm:self-auto cursor-pointer"
                    >
                        + Create a Listing
                    </button>
                )}
            </div>

            {/* Filter Bar */}
            <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-3 glass-card rounded-2xl p-4 shadow-sm">
                <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">City</label>
                    <input
                        type="text"
                        placeholder="e.g. New York"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-amber-400"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Type</label>
                    <select
                        value={listingType}
                        onChange={(e) => setListingType(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-amber-400"
                    >
                        <option value="">All Types</option>
                        <option value="RENT">For Rent</option>
                        <option value="SALE">For Sale</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Min Price</label>
                    <input
                        type="number"
                        placeholder="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-amber-400"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider">Max Price</label>
                    <input
                        type="number"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-amber-400"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        type="submit"
                        className="w-full rounded-xl gold-glow-btn py-2 text-xs font-bold cursor-pointer"
                    >
                        Apply Filters
                    </button>
                </div>
            </form>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                            selectedCategory === cat.id
                                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-amber-500/30'
                        }`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* Grid listings */}
            {loading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                </div>
            ) : listings.length === 0 ? (
                <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl">
                    <p className="text-sm text-[var(--color-text-muted)]">No listings found matching your criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {listings.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => navigate(`/marketplace/${item.id}`)}
                            className="group cursor-pointer rounded-2xl border border-[var(--color-border)] glass-card overflow-hidden transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 hover:border-amber-500/40"
                        >
                            <div>
                                <div className="h-44 w-full bg-[var(--color-surface-dark)] relative flex items-center justify-center overflow-hidden">
                                    {item.images && item.images.length > 0 ? (
                                        <img
                                            src={item.images[0]}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="text-5xl">🏢</div>
                                    )}
                                    <span className={`absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg shadow-md ${
                                        item.listing_type === 'RENT' ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300' : 'bg-emerald-500 text-slate-950 ring-1 ring-emerald-300'
                                    }`}>
                                        {item.listing_type === 'RENT' ? 'For Rent' : 'For Sale'}
                                    </span>
                                </div>

                                <div className="p-4">
                                    <h3 className="font-bold text-sm line-clamp-1 group-hover:text-amber-400 transition-colors text-white">{item.title}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{item.city}{item.locality ? `, ${item.locality}` : ''}</p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-2 line-clamp-2">{item.description}</p>
                                </div>
                            </div>

                            <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface-dark)]/30">
                                <span className="text-sm font-extrabold text-amber-400">
                                    ${item.price.toLocaleString()}
                                    {item.listing_type === 'RENT' && <span className="text-[10px] text-[var(--color-text-muted)] font-normal">/{item.rent_frequency}</span>}
                                </span>
                                <span className="text-xs text-amber-400 font-bold group-hover:underline">View Details →</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Listing Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] w-full max-w-lg rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">Create Marketplace Listing</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-[var(--color-text-muted)] hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateListing} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Title</label>
                                <input
                                    required
                                    value={newListing.title}
                                    onChange={(e) => setNewListing(c => ({ ...c, title: e.target.value }))}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--color-primary)]"
                                    placeholder="e.g. 2 BHK Spacious Apartment"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Category</label>
                                <select
                                    required
                                    value={newListing.category_id}
                                    onChange={(e) => setNewListing(c => ({ ...c, category_id: e.target.value }))}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Listing Type</label>
                                    <select
                                        value={newListing.listing_type}
                                        onChange={(e) => setNewListing(c => ({ ...c, listing_type: e.target.value }))}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        <option value="RENT">For Rent</option>
                                        <option value="SALE">For Sale</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Price ($)</label>
                                    <input
                                        type="number"
                                        required
                                        value={newListing.price}
                                        onChange={(e) => setNewListing(c => ({ ...c, price: e.target.value }))}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                        placeholder="1200"
                                    />
                                </div>
                            </div>

                            {newListing.listing_type === 'RENT' && (
                                <div>
                                    <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Rent Frequency</label>
                                    <select
                                        value={newListing.rent_frequency}
                                        onChange={(e) => setNewListing(c => ({ ...c, rent_frequency: e.target.value }))}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="daily">Daily</option>
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">City</label>
                                    <input
                                        required
                                        value={newListing.city}
                                        onChange={(e) => setNewListing(c => ({ ...c, city: e.target.value }))}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                        placeholder="New York"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Locality</label>
                                    <input
                                        value={newListing.locality}
                                        onChange={(e) => setNewListing(c => ({ ...c, locality: e.target.value }))}
                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none"
                                        placeholder="Brooklyn"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Description</label>
                                <textarea
                                    value={newListing.description}
                                    onChange={(e) => setNewListing(c => ({ ...c, description: e.target.value }))}
                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:outline-none h-20 resize-none"
                                    placeholder="Tell potential buyers/renters more details..."
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-semibold">Upload Images</label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-primary)]/15 file:text-[var(--color-primary-light)] hover:file:bg-[var(--color-primary)]/20"
                                />
                                {uploading && <p className="text-xs text-[var(--color-primary-light)] mt-1.5 animate-pulse">Uploading...</p>}
                                
                                {uploadedImages.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {uploadedImages.map((url, idx) => (
                                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 group">
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>


                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-xl gold-glow-btn py-3 text-sm font-bold disabled:opacity-60 cursor-pointer"
                            >
                                {submitting ? 'Submitting...' : 'Submit Listing'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
