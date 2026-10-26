/**
 * Reusable luxury stat card for the dashboard overview.
 * Supports optional onClick to make the card navigable.
 */
export default function StatCard({ icon, label, value, accent = 'var(--color-primary)', onClick }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            onClick={onClick}
            className={`group relative glass-card rounded-2xl p-5 text-left w-full transition-all duration-300 ${
                onClick ? 'cursor-pointer hover:-translate-y-1 hover:border-amber-500/40' : ''
            }`}
        >
            {/* Ambient accent top/left glow */}
            <div
                className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl transition-all group-hover:w-2"
                style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
            />
            
            <div className="flex items-center gap-4">
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner transition-transform duration-300 group-hover:scale-110"
                    style={{ 
                        background: `radial-gradient(circle, ${accent}25 0%, ${accent}08 100%)`,
                        border: `1px solid ${accent}40`,
                    }}
                >
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 truncate">{label}</p>
                    <p className="text-2xl font-extrabold tracking-tight text-white">{value}</p>
                </div>
            </div>
            {onClick && (
                <div className="mt-3 flex items-center justify-end text-[10px] font-bold text-amber-400 opacity-60 group-hover:opacity-100 transition-opacity">
                    View details →
                </div>
            )}
        </Tag>
    );
}
