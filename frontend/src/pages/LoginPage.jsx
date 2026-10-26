import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import { Building2, Lock, Mail, User, Phone, Briefcase, Eye, EyeOff, ShieldCheck, ArrowRight, Sparkles, Clock, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import Modal from '../components/Modal';

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
    const [statusModal, setStatusModal] = useState(null);

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
            const detail = error?.response?.data?.detail || '';
            if (detail.includes('ACCOUNT_PENDING:')) {
                const message = detail.replace(/ACCOUNT_PENDING:/i, '').trim();
                setStatusModal({
                    status: 'pending',
                    title: 'Account Awaiting Admin Approval',
                    message: message || 'Your account registration has been received, but an administrator has not approved your account yet. Please wait for an administrator to activate your account.',
                    email: loginForm.email,
                });
            } else if (detail.includes('ACCOUNT_REJECTED:')) {
                const reason = detail.replace(/ACCOUNT_REJECTED:/i, '').trim();
                setStatusModal({
                    status: 'rejected',
                    title: 'Registration Request Rejected',
                    message: reason || 'Your account registration was reviewed and rejected by an administrator.',
                    email: loginForm.email,
                });
            } else {
                toast.error(detail || 'Failed to sign in.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            const res = await register(registerForm);
            setStatusModal({
                status: 'registered',
                title: 'Registration Submitted for Approval',
                message: res?.message || 'Your account has been created successfully! Because administrator approval is required, an administrator will review your account before you can log in.',
                email: registerForm.email,
            });
            // Pre-fill the login form and switch tab to signin
            setLoginForm((c) => ({ ...c, email: registerForm.email, password: '' }));
            setRegisterForm(emptyRegisterForm);
        } catch (error) {
            console.error(error);
            const detail = error?.response?.data?.detail || '';
            if (detail.includes('ACCOUNT_PENDING:')) {
                const message = detail.replace(/ACCOUNT_PENDING:/i, '').trim();
                setStatusModal({
                    status: 'pending',
                    title: 'Account Already Awaiting Approval',
                    message: message || 'An account with this email is already registered and awaiting administrator approval.',
                    email: registerForm.email,
                });
                setLoginForm((c) => ({ ...c, email: registerForm.email }));
            } else if (detail.includes('ACCOUNT_REJECTED:')) {
                const reason = detail.replace(/ACCOUNT_REJECTED:/i, '').trim();
                setStatusModal({
                    status: 'rejected',
                    title: 'Registration Request Rejected',
                    message: reason,
                    email: registerForm.email,
                });
            } else if (
                detail.toLowerCase().includes('already registered') ||
                detail.toLowerCase().includes('already exists')
            ) {
                setStatusModal({
                    status: 'exists',
                    title: 'Email Already Registered',
                    message: 'An account with this email address already exists in the system. If you recently registered, your account is awaiting administrator review. You can also proceed to Sign In.',
                    email: registerForm.email,
                });
                setLoginForm((c) => ({ ...c, email: registerForm.email }));
            } else {
                toast.error(detail || 'Failed to register.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleBootstrap = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            await bootstrapAdmin(bootstrapForm);
            toast.success('Initial admin created successfully. You are now logged in.');
            navigate('/');
        } catch (error) {
            console.error(error);
            toast.error(error?.response?.data?.detail || 'Failed to create admin account.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[var(--color-surface-dark)] text-[var(--color-text)]">
            {/* Ambient luxury gold background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.15),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.1),transparent_50%)] pointer-events-none" />

            <div className="relative w-full max-w-md animate-fade-in-up">
                {/* Project Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-xl shadow-amber-500/25 text-slate-950 mb-3.5 ring-2 ring-amber-400/40">
                        <Building2 className="w-7 h-7" />
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-3xl font-extrabold tracking-tight text-white gold-gradient-text">
                            RentFlow
                        </h1>
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--color-text-muted)] font-medium">
                        {setup?.needs_bootstrap
                            ? 'Initial System Administrator Setup'
                            : activeTab === 'signin'
                            ? 'Welcome back! Sign in to access your luxury rental portal'
                            : 'Create an account to manage or browse properties'}
                    </p>
                </div>

                {/* Main Card */}
                <div className="rounded-3xl border border-amber-500/20 bg-[var(--color-surface)]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/80">
                    {loading ? (
                        <div className="flex min-h-[300px] items-center justify-center">
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                        </div>
                    ) : setup?.needs_bootstrap ? (
                        /* Bootstrap Admin Form */
                        <div>
                            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                <span>Create the first administrator account to get started.</span>
                            </div>

                            {!setup.has_service_role && (
                                <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
                                    Add <code className="bg-black/40 px-1.5 py-0.5 rounded text-white font-mono">SUPABASE_SERVICE_ROLE_KEY</code> in the backend environment.
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
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={submitting || !setup.has_service_role}
                                    className="w-full rounded-xl gold-glow-btn px-4 py-3 text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-2"
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
                            <div className="flex p-1 bg-[var(--color-surface-dark)] rounded-2xl border border-[var(--color-border)] mb-6">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('signin')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                        activeTab === 'signin'
                                            ? 'bg-amber-500 text-slate-950 shadow-md'
                                            : 'text-[var(--color-text-muted)] hover:text-white'
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('register')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                                        activeTab === 'register'
                                            ? 'bg-amber-500 text-slate-950 shadow-md'
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-10 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)] hover:text-amber-300 cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full rounded-xl gold-glow-btn px-4 py-3 text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
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
                                                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                                    registerForm.role === 'user'
                                                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                                                        : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
                                                }`}
                                            >
                                                👤 Tenant / User
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRegisterForm((c) => ({ ...c, role: 'owner' }))}
                                                className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                                    registerForm.role === 'owner'
                                                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-amber-400 focus:outline-none transition-colors"
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
                                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-dark)] pl-10 pr-4 py-2 text-xs text-white focus:border-amber-400 focus:outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full rounded-xl gold-glow-btn px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-1"
                                    >
                                        {submitting ? 'Creating account...' : 'Create Account'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
                {/* Interactive Status / Confirmation Modal */}
                <Modal
                    isOpen={Boolean(statusModal)}
                    open={Boolean(statusModal)}
                    onClose={() => setStatusModal(null)}
                    title={statusModal?.title || 'Account Status'}
                    size="sm"
                >
                    <div className="p-6 text-center space-y-4">
                        {statusModal?.status === 'registered' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                        )}
                        {statusModal?.status === 'pending' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                <Clock className="w-9 h-9 animate-pulse" />
                            </div>
                        )}
                        {statusModal?.status === 'rejected' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                                <AlertTriangle className="w-9 h-9" />
                            </div>
                        )}
                        {statusModal?.status === 'exists' && (
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                <ShieldAlert className="w-9 h-9" />
                            </div>
                        )}

                        <div>
                            <h3 className="text-base font-bold text-white mb-2">{statusModal?.title}</h3>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-sm mx-auto">
                                {statusModal?.message}
                            </p>
                            {statusModal?.email && (
                                <div className="mt-3 inline-block rounded-lg bg-[var(--color-surface-dark)] border border-[var(--color-border)] px-3 py-1 text-xs font-mono text-amber-300">
                                    {statusModal.email}
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const nextTab = (statusModal?.status === 'registered' || statusModal?.status === 'exists') ? 'signin' : activeTab;
                                    setStatusModal(null);
                                    if (nextTab === 'signin') {
                                        setActiveTab('signin');
                                    }
                                }}
                                className="w-full py-2.5 px-4 rounded-xl gold-glow-btn text-xs font-bold cursor-pointer"
                            >
                                {statusModal?.status === 'registered' || statusModal?.status === 'exists'
                                    ? 'Proceed to Sign In'
                                    : 'Got it'}
                            </button>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}
