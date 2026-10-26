import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import Sidebar from './Sidebar';
import { LogOut, Menu } from 'lucide-react';

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { logout, user } = useAuth();
    const initials = (user?.full_name || user?.email || 'U').trim().charAt(0).toUpperCase();

    return (
        <div className="flex min-h-screen bg-[var(--color-surface-dark)]">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="sticky top-0 z-20 bg-[var(--color-surface)]/80 backdrop-blur-xl border-b border-[var(--color-border)] px-4 md:px-8 py-3.5 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden text-[var(--color-text-muted)] hover:text-amber-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden md:flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <h1 className="text-xs font-semibold tracking-wider uppercase text-[var(--color-text-muted)]">
                                RentFlow Luxury Portal
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden text-right md:block">
                            <p className="text-xs font-bold text-white tracking-tight">{user?.full_name || user?.email || 'User'}</p>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-amber-400">{user?.role || 'viewer'}</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center text-xs font-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300/40">
                            {initials}
                        </div>
                        <button
                            onClick={logout}
                            title="Sign out"
                            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-light)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-all hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
