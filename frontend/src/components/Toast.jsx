/* eslint-disable react-refresh/only-export-components */
/**
 * Lightweight luxury toast notification system.
 * Usage: import { ToastProvider, useToast } from './Toast';
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timeoutMap = useRef(new Map());

    const removeToast = useCallback((id) => {
        const timeoutId = timeoutMap.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutMap.current.delete(id);
        }
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((message, type = 'error', options = {}) => {
        const {
            duration = type === 'confirm' ? 0 : 4000,
            title = '',
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            onConfirm,
            onCancel,
        } = options;

        const id = Date.now() + Math.random();
        setToasts((prev) => [
            ...prev,
            {
                id,
                message,
                title,
                type,
                confirmLabel,
                cancelLabel,
                onConfirm,
                onCancel,
            },
        ]);

        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                removeToast(id);
            }, duration);
            timeoutMap.current.set(id, timeoutId);
        }

        return id;
    }, [removeToast]);

    const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
        addToast(message, 'confirm', {
            ...options,
            duration: 0,
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
        });
    }), [addToast]);

    const value = useMemo(() => ({
        error: (msg, options) => addToast(msg, 'error', options),
        success: (msg, options) => addToast(msg, 'success', options),
        info: (msg, options) => addToast(msg, 'info', options),
        confirm,
    }), [addToast, confirm]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            <div className="fixed bottom-6 right-6 z-[100] flex max-w-sm flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => {
                    const styleClass = toast.type === 'error'
                        ? 'bg-[#1a0f14]/95 border-rose-500/40 text-rose-300 shadow-rose-950/50'
                        : toast.type === 'success'
                            ? 'bg-[#0e1c18]/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/50'
                            : toast.type === 'confirm'
                                ? 'bg-[#1c160e]/95 border-amber-500/40 text-amber-200 shadow-amber-950/50'
                                : 'bg-[#121824]/95 border-amber-500/30 text-amber-300 shadow-black/60';

                    const IconComp = toast.type === 'error'
                        ? AlertCircle
                        : toast.type === 'success'
                            ? CheckCircle2
                            : toast.type === 'confirm'
                                ? HelpCircle
                                : Info;

                    return (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl animate-fade-in-up transition-all ${styleClass}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/10 text-current">
                                    <IconComp className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {toast.title && (
                                        <p className="mb-0.5 text-xs font-bold text-white tracking-tight">{toast.title}</p>
                                    )}
                                    <p className="text-xs leading-5 text-slate-200">
                                        {toast.message}
                                    </p>

                                    {toast.type === 'confirm' ? (
                                        <div className="mt-3 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    toast.onCancel?.();
                                                    removeToast(toast.id);
                                                }}
                                                className="rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer"
                                            >
                                                {toast.cancelLabel}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    toast.onConfirm?.();
                                                    removeToast(toast.id);
                                                }}
                                                className="rounded-xl gold-glow-btn px-3 py-1.5 text-[11px] font-bold cursor-pointer"
                                            >
                                                {toast.confirmLabel}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => removeToast(toast.id)}
                                            className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-amber-300 transition-colors cursor-pointer"
                                        >
                                            Dismiss
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
