import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';

const emptyLoginForm = {
    email: '',
    password: '',
};

const emptyRegisterForm = {
    full_name: '',
    email: '',
    password: '',
    role: 'user',
    phone: '',
    company_or_agency: '',
};

const emptyBootstrapForm = {
    full_name: '',
    email: '',
    password: '',
};

export default function LoginPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const { bootstrapAdmin, isAuthenticated, loading, login, register, setup } = useAuth();
    const [activeTab, setActiveTab] = useState('signin');
    const [loginForm, setLoginForm] = useState(emptyLoginForm);
    const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
    const [bootstrapForm, setBootstrapForm] = useState(emptyBootstrapForm);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    if (!loading && isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleLogin = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await login(loginForm);
            toast.success('Signed in successfully.');
            navigate('/');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to sign in.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await register(registerForm);
            toast.success('Registration successful. You are now logged in.');
            navigate('/');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to register.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBootstrap = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await bootstrapAdmin(bootstrapForm);
            toast.success('Admin account created.');
            navigate('/');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to create admin account.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.18),transparent_34%)]" />
            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 md:px-8">
                <div className="grid w-full gap-8 lg:grid-cols-[1fr_1.1fr]">
                    {/* Left Panel */}
                    <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,rgba(15,23,42,.96),rgba(30,41,59,.92))] p-8 shadow-[0_24px_80px_rgba(2,6,23,.38)] flex flex-col justify-between">
                        <div>
                            <p className="mb-3 text-sm uppercase tracking-[0.28em] text-[var(--color-primary-light)]">RentFlow</p>
                            <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl text-white">
                                Multi-Admin Rental & Classified Marketplace
                            </h1>
                            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--color-text-muted)]">
                                Sign up or log in to manage your rental assets, lease agreements, and log utility meters, or list properties and goods for sale to active buyers.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary-light)]">Owners / Sellers</p>
                                <p className="text-xs text-[var(--color-text-muted)]">List your homes, apartments, furniture or devices for rent and sale. Manage counter-offers & schedule visits.</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-[var(--color-primary-light)]">Buyers / Tenants</p>
                                <p className="text-xs text-[var(--color-text-muted)]">Browse filterable listings in your city. Negotiate deals using interactive chat and pay securely online.</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,.96),rgba(15,23,42,.98))] p-8 shadow-[0_24px_80px_rgba(2,6,23,.32)]">
                        {loading ? (
                            <div className="flex min-h-[420px] items-center justify-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                            </div>
                        ) : setup.needs_bootstrap ? (
                            /* Bootstrap Admin (First-time setup) */
                            <div>
                                <p className="mb-2 text-sm uppercase tracking-[0.24em] text-[var(--color-warning)]">Initial Setup</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">Create the first admin</h2>
                                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                                    This workspace does not have an admin yet. Create the first admin account to unlock user management.
                                </p>

                                {!setup.has_service_role && (
                                    <div className="mt-4 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 p-3 text-xs text-[var(--color-text)]">
                                        Add `SUPABASE_SERVICE_ROLE_KEY` in the backend environment before bootstrapping the first admin.
                                    </div>
                                )}

                                <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
                                    <div>
                                        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Full Name</label>
                                        <input
                                            required
                                            value={bootstrapForm.full_name}
                                            onChange={(event) => setBootstrapForm((current) => ({ ...current, full_name: event.target.value }))}
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={bootstrapForm.email}
                                            onChange={(event) => setBootstrapForm((current) => ({ ...current, email: event.target.value }))}
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Password</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={bootstrapForm.password}
                                            onChange={(event) => setBootstrapForm((current) => ({ ...current, password: event.target.value }))}
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting || !setup.has_service_role}
                                        className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
                                    >
                                        {submitting ? 'Creating admin...' : 'Create Admin Account'}
                                    </button>
                                </form>
                            </div>
                        ) : (
                            /* Login vs Register Tabs */
                            <div>
                                <div className="flex border-b border-white/10 mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('signin')}
                                        className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                                            activeTab === 'signin' ? 'border-[var(--color-primary)] text-white' : 'border-transparent text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('register')}
                                        className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                                            activeTab === 'register' ? 'border-[var(--color-primary)] text-white' : 'border-transparent text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        Self Registration
                                    </button>
                                </div>

                                {activeTab === 'signin' ? (
                                    /* SIGN IN FORM */
                                    <form onSubmit={handleLogin} className="space-y-4">
                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={loginForm.email}
                                                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Password</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    minLength={6}
                                                    value={loginForm.password}
                                                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 pr-10 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)] hover:text-white"
                                                >
                                                    {showPassword ? 'Hide' : 'Show'}
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
                                        >
                                            {submitting ? 'Signing in...' : 'Sign In'}
                                        </button>
                                    </form>
                                ) : (
                                    /* REGISTER FORM */
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)] font-medium">I want to...</label>
                                            <div className="grid grid-cols-2 gap-3 mt-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setRegisterForm((current) => ({ ...current, role: 'owner' }))}
                                                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                                                        registerForm.role === 'owner'
                                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                            : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                                                    }`}
                                                >
                                                    List Properties / Sell
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRegisterForm((current) => ({ ...current, role: 'user' }))}
                                                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                                                        registerForm.role === 'user'
                                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                            : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)]'
                                                    }`}
                                                >
                                                    Rent / Buy Items
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Full Name</label>
                                            <input
                                                required
                                                value={registerForm.full_name}
                                                onChange={(event) => setRegisterForm((current) => ({ ...current, full_name: event.target.value }))}
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Email</label>
                                            <input
                                                type="email"
                                                required
                                                value={registerForm.email}
                                                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Phone Number</label>
                                            <input
                                                type="tel"
                                                value={registerForm.phone}
                                                onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))}
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                            />
                                        </div>

                                        {registerForm.role === 'owner' && (
                                            <div>
                                                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Company or Agency Name</label>
                                                <input
                                                    value={registerForm.company_or_agency}
                                                    onChange={(event) => setRegisterForm((current) => ({ ...current, company_or_agency: event.target.value }))}
                                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Password</label>
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={registerForm.password}
                                                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] px-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--color-primary-dark)] disabled:opacity-60"
                                        >
                                            {submitting ? 'Registering...' : 'Register'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
