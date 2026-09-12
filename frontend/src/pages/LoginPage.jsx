import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import { Building2, Lock, Mail, User, Phone, Briefcase, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

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
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-bg)] text-[var(--color-text)]">
            {/* Ambient background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.12),transparent_50%),radial-gradient(circle_at_bottom,rgba(56,189,248,0.08),transparent_50%)] pointer-events-none" />

            <div className="relative w-full max-w-md">
                {/* Project Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--color-primary)] to-indigo-400 shadow-lg shadow-indigo-500/25 text-white mb-3.5">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-white">
                        RentFlow
                    </h1>
                    <p className="mt-1.5 text-xs text-[var(--color-text-muted)] font-medium">
                        {setup?.needs_bootstrap
                            ? 'Initial System Administrator Setup'
                            : activeTab === 'signin'
                            ? 'Welcome back! Sign in to access your dashboard'
                            : 'Create an account to manage or browse rentals'}
                    </p>
                </div>

                {/* Main Card */}
                <div className="rounded-3xl border border-white/10 bg-[var(--color-surface)]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/40">
                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                        </div>
                    ) : setup?.needs_bootstrap ? (
                        /* Bootstrap Admin Form */
                        <div>
                            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span>Create the first administrator account to get started.</span>
                            </div>

                            {!setup.has_service_role && (
                                <div className="mb-4 rounded-xl border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 p-3 text-xs text-[var(--color-text)]">
                                    Add <code className="bg-black/30 px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in the backend environment.
                                </div>
                            )}

                            <form onSubmit={handleBootstrap} className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                        <input
                                            required
                                            value={bootstrapForm.full_name}
                                            onChange={(e) => setBootstrapForm((c) => ({ ...c, full_name: e.target.value }))}
                                            placeholder="Admin Name"
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                        <input
                                            type="email"
                                            required
                                            value={bootstrapForm.email}
                                            onChange={(e) => setBootstrapForm((c) => ({ ...c, email: e.target.value }))}
                                            placeholder="admin@example.com"
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={bootstrapForm.password}
                                            onChange={(e) => setBootstrapForm((c) => ({ ...c, password: e.target.value }))}
                                            placeholder="••••••••"
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || !setup.has_service_role}
                                    className="w-full rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                >
                                    {submitting ? 'Creating admin...' : 'Create Administrator Account'}
                                    {!submitting && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* Login vs Register Tabs */
                        <div>
                            {/* Segmented Control Tab Switcher */}
                            <div className="flex p-1 bg-[var(--color-surface-dark)] rounded-2xl border border-white/5 mb-6">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('signin')}
                                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                                        activeTab === 'signin'
                                            ? 'bg-[var(--color-primary)] text-white shadow-md'
                                            : 'text-[var(--color-text-muted)] hover:text-white'
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('register')}
                                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                                        activeTab === 'register'
                                            ? 'bg-[var(--color-primary)] text-white shadow-md'
                                            : 'text-[var(--color-text-muted)] hover:text-white'
                                    }`}
                                >
                                    Create Account
                                </button>
                            </div>

                            {activeTab === 'signin' ? (
                                /* SIGN IN FORM */
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                type="email"
                                                required
                                                value={loginForm.email}
                                                onChange={(e) => setLoginForm((c) => ({ ...c, email: e.target.value }))}
                                                placeholder="you@example.com"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">
                                            Password
                                        </label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                minLength={6}
                                                value={loginForm.password}
                                                onChange={(e) => setLoginForm((c) => ({ ...c, password: e.target.value }))}
                                                placeholder="••••••••"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-10 py-2.5 text-sm text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)] hover:text-white"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                <span>Signing in...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Sign In</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                /* REGISTER FORM */
                                <form onSubmit={handleRegister} className="space-y-3.5">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">
                                            I am registering as:
                                        </label>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <button
                                                type="button"
                                                onClick={() => setRegisterForm((c) => ({ ...c, role: 'user' }))}
                                                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                                                    registerForm.role === 'user'
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md'
                                                        : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
                                                }`}
                                            >
                                                👤 Tenant / User
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRegisterForm((c) => ({ ...c, role: 'owner' }))}
                                                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                                                    registerForm.role === 'owner'
                                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-md'
                                                        : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
                                                }`}
                                            >
                                                🏢 Property Owner
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                required
                                                value={registerForm.full_name}
                                                onChange={(e) => setRegisterForm((c) => ({ ...c, full_name: e.target.value }))}
                                                placeholder="e.g. John Doe"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                type="email"
                                                required
                                                value={registerForm.email}
                                                onChange={(e) => setRegisterForm((c) => ({ ...c, email: e.target.value }))}
                                                placeholder="name@example.com"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                type="tel"
                                                value={registerForm.phone}
                                                onChange={(e) => setRegisterForm((c) => ({ ...c, phone: e.target.value }))}
                                                placeholder="+91 9876543210"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {registerForm.role === 'owner' && (
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Company or Agency Name</label>
                                            <div className="relative">
                                                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                                <input
                                                    value={registerForm.company_or_agency}
                                                    onChange={(e) => setRegisterForm((c) => ({ ...c, company_or_agency: e.target.value }))}
                                                    placeholder="e.g. Acme Properties"
                                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-[var(--color-text-muted)]">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={registerForm.password}
                                                onChange={(e) => setRegisterForm((c) => ({ ...c, password: e.target.value }))}
                                                placeholder="••••••••"
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-1"
                                    >
                                        {submitting ? 'Creating account...' : 'Create Account'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
