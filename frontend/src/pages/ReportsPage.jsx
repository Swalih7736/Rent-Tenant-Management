import { useEffect, useState, useMemo } from 'react';
import { fetchPayments, fetchProperties, fetchTenants, fetchRevenue } from '../api';
import { useToast } from '../components/Toast';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e'];

export default function ReportsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    useEffect(() => {
        async function load() {
            try {
                const [properties, tenants, payments, revenue] = await Promise.all([
                    fetchProperties(),
                    fetchTenants(),
                    fetchPayments(),
                    fetchRevenue(),
                ]);
                setData({ properties, tenants, payments, revenue });
            } catch (err) {
                console.error('Reports load error:', err);
                toast.error('Failed to load reports data.');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [toast]);

    // Computed stats
    const stats = useMemo(() => {
        if (!data) return null;
        const { properties, tenants, payments, revenue } = data;
        const activeTenants = tenants.filter(t => t.status === 'active');
        const totalUnits = properties.reduce((s, p) => s + (p.total_units || 0), 0);

        // Expected revenue = sum of rent_amount for all properties with active tenants
        const currentMonth = new Date().toISOString().slice(0, 7);
        const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));
        const expectedRevenue = activeTenants.reduce((sum, t) => {
            const prop = propertyMap[t.property_id];
            return sum + Number(prop?.rent_amount || 0);
        }, 0);

        const collectionRate = expectedRevenue > 0
            ? ((revenue.total_revenue / expectedRevenue) * 100).toFixed(1)
            : 0;

        // Revenue by property
        const revenueByProperty = {};
        payments.forEach(p => {
            const tenant = tenants.find(t => t.id === p.tenant_id);
            const prop = tenant ? propertyMap[tenant.property_id] : null;
            const propName = prop?.address || 'Unknown';
            revenueByProperty[propName] = (revenueByProperty[propName] || 0) + Number(p.amount_paid || 0);
        });
        const barData = Object.entries(revenueByProperty).map(([name, revenue]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '…' : name,
            revenue,
        }));

        // Payment status for current month
        const currentMonthPayments = payments.filter(p => p.month_covered === currentMonth);
        const paidByTenant = currentMonthPayments.reduce((acc, p) => {
            acc[p.tenant_id] = (acc[p.tenant_id] || 0) + Number(p.amount_paid || 0);
            return acc;
        }, {});

        let paidCount = 0, pendingCount = 0, overdueCount = 0;
        activeTenants.forEach(t => {
            const prop = propertyMap[t.property_id];
            const rentDue = Number(prop?.rent_amount || 0);
            const paid = paidByTenant[t.id] || 0;
            if (paid >= rentDue) paidCount++;
            else if (paid > 0) pendingCount++;
            else overdueCount++;
        });

        const total = paidCount + pendingCount + overdueCount;
        const pieData = [
            { name: 'Paid', value: paidCount, percentage: total > 0 ? Math.round((paidCount / total) * 100) : 0 },
            { name: 'Pending', value: pendingCount, percentage: total > 0 ? Math.round((pendingCount / total) * 100) : 0 },
            { name: 'Overdue', value: overdueCount, percentage: total > 0 ? Math.round((overdueCount / total) * 100) : 0 },
        ].filter(d => d.value > 0);

        return {
            totalRevenue: revenue.total_revenue,
            collectionRate,
            propertyCount: properties.length,
            totalUnits,
            activeTenantCount: activeTenants.length,
            barData,
            pieData,
        };
    }, [data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!stats) return null;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-card rounded-xl px-4 py-3 shadow-2xl border border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{payload[0].payload.name}</p>
                    <p className="text-base font-extrabold text-[var(--color-primary)] mt-0.5">₹{Number(payload[0].value).toLocaleString()}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="border-b border-[var(--color-border)]/60 pb-5">
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                    Financial Reports & <span className="gold-gradient-text">Analytics</span>
                </h1>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">
                    Real-time performance metrics and revenue intelligence for your rental portfolio.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
                <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80" />
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Total Revenue</p>
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm">
                            ₹
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-white tracking-tight">₹{stats.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-emerald-400/80 font-medium mt-1 flex items-center gap-1">
                        <span>●</span> Collected this fiscal period
                    </p>
                </div>

                <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-primary)] to-amber-300 opacity-80" />
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Collection Efficiency</p>
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[var(--color-primary)] text-sm">
                            📈
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-white tracking-tight">{stats.collectionRate}%</p>
                    <p className="text-xs text-amber-400/80 font-medium mt-1 flex items-center gap-1">
                        <span>●</span> Realized vs expected rent
                    </p>
                </div>

                <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-80" />
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Total Properties</p>
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 text-sm">
                            🏢
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-white tracking-tight">{stats.propertyCount}</p>
                    <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1">
                        <span>●</span> {stats.totalUnits} registered units
                    </p>
                </div>

                <div className="glass-card rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 opacity-80" />
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider">Active Occupants</p>
                        <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 text-sm">
                            👥
                        </div>
                    </div>
                    <p className="text-3xl font-extrabold text-white tracking-tight">{stats.activeTenantCount}</p>
                    <p className="text-xs text-purple-400/80 font-medium mt-1 flex items-center gap-1">
                        <span>●</span> Active verified leases
                    </p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue by Property - Bar Chart */}
                <div className="glass-card rounded-2xl p-6 shadow-xl border border-[var(--color-border)]">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-white">Revenue by Property</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Cumulative collected rent broken down per asset</p>
                    </div>
                    {stats.barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                            No payment data recorded yet
                        </div>
                    )}
                </div>

                {/* Payment Status - Pie Chart */}
                <div className="glass-card rounded-2xl p-6 shadow-xl border border-[var(--color-border)]">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-white">Current Month Settlement</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Distribution of rent payment statuses across active tenants</p>
                    </div>
                    {stats.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={stats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={105}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percentage }) => `${name} ${percentage}%`}
                                >
                                    {stats.pieData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={PIE_COLORS[['Paid', 'Pending', 'Overdue'].indexOf(entry.name)] || PIE_COLORS[0]}
                                        />
                                    ))}
                                </Pie>
                                <Legend
                                    wrapperStyle={{ fontSize: '12px', color: 'var(--color-text-muted)', paddingTop: '10px' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(18, 24, 36, 0.95)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                                    }}
                                    formatter={(value, name) => [`${value} tenant${value !== 1 ? 's' : ''}`, name]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                            No tenants to display
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
