import { createPortal } from 'react-dom';

/**
 * Reusable luxury modal dialog with glass-morphism backdrop.
 */
export default function Modal({
    open,
    isOpen,
    onClose,
    title,
    children,
    maxWidth,
    size = 'md',
}) {
    const isVisible = open !== undefined ? open : isOpen;
    if (!isVisible) return null;

    const sizeClass = maxWidth || (
        size === 'sm' ? 'max-w-md' :
        size === 'lg' ? 'max-w-2xl' :
        size === 'xl' ? 'max-w-4xl' :
        'max-w-lg'
    );

    return createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
                {/* Panel */}
                <div className={`relative flex max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] w-full ${sizeClass} flex-col overflow-hidden rounded-3xl border border-amber-500/20 bg-[var(--color-surface)]/95 shadow-2xl shadow-black/80 backdrop-blur-2xl animate-fade-in-up`}>
                    {/* Top gold accent line */}
                    <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 shrink-0 bg-[var(--color-surface-dark)]/40">
                        <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto px-6 py-5">{children}</div>
                </div>
            </div>
        </div>,
        document.body
    );
}
