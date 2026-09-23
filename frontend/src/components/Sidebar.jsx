import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from './AuthProvider';
import {
    LayoutDashboard,
    Home,
    ClipboardCheck,
    Store,
    Calendar,
    MessageSquare,
    Building2,
    Users,
    CreditCard,
    BarChart3,
    ShieldCheck,
} from 'lucide-react';

export default function Sidebar({ open, onClose }) {
    const { user } = useAuth();

    const links = useMemo(() => {
        const role = user?.role?.toLowerCase() || '';
        
        // Links for normal Buyer/Tenant (USER / VIEWER) role
        if (role === 'user' || role === 'viewer') {
            return [
                { to: '/', label: 'My Rental', icon: Home },
                { to: '/marketplace', label: 'Marketplace', icon: Store },
                { to: '/bookings', label: 'Walkthroughs', icon: Calendar },
                { to: '/chat', label: 'Chats', icon: MessageSquare },
                { to: '/payments', label: 'Payments', icon: CreditCard },
            ];
        }

        // Links for Owner, Manager, Admin
        const items = [
            { to: '/', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/rental-requests', label: 'Rental Requests', icon: ClipboardCheck },
            { to: '/marketplace', label: 'Marketplace', icon: Store },
            { to: '/bookings', label: 'Walkthroughs', icon: Calendar },
            { to: '/chat', label: 'Chats', icon: MessageSquare },
            { to: '/properties', label: 'Properties', icon: Building2 },
            { to: '/tenants', label: 'Tenants', icon: Users },
            { to: '/payments', label: 'Payments', icon: CreditCard },
            { to: '/reports', label: 'Reports', icon: BarChart3 },
        ];

        if (role === 'admin') {
            items.push({ to: '/users', label: 'Users', icon: ShieldCheck });
        }

        return items;
    }, [user]);

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={onClose}
                />
            )}

            <aside
                className={`
          fixed top-0 left-0 z-40 h-screen
          w-[var(--sidebar-width)] bg-[var(--color-surface)]
          border-r border-[var(--color-border)]
          flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:z-auto md:h-screen md:sticky md:top-0
        `}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--color-border)]">
                    <img src={logo} alt="RentFlow Logo" className="w-9 h-9 rounded-lg object-cover" />
                    <span className="text-lg font-semibold tracking-tight">RentFlow</span>
                </div>

                {/* Nav links */}
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {links.map(({ to, label, icon: IconComponent }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-[var(--transition-base)]
                ${isActive
                                    ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary-light)] font-semibold shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
                                }`
                            }
                        >
                            <IconComponent className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-6 py-4 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                    © 2026 RentFlow
                </div>
            </aside>
        </>
    );
}
