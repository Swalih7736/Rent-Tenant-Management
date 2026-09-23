import { useState, useEffect } from 'react'
import api from '../api'

/**
 * PaymentModal — opens the Razorpay checkout popup for tenant rent payment.
 *
 * Props:
 *   tenant    — tenant object { id, name, email, phone, property_id }
 *   amount    — monthly rent amount (number)
 *   onClose   — called when modal is dismissed
 *   onSuccess — called after successful payment, receives the Razorpay response
 */
export default function PaymentModal({ tenant, amount, onClose, onSuccess }) {
  const [step, setStep]           = useState('confirm')  // confirm | paying | success | error
  const [message, setMessage]     = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [copiedCard, setCopiedCard] = useState(false)
  const [copiedUpi, setCopiedUpi]   = useState(false)

  // Load Razorpay JS SDK once on mount
  useEffect(() => {
    if (window.Razorpay) return
    const script = document.createElement('script')
    script.src   = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { try { document.body.removeChild(script) } catch {} }
  }, [])

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text)
    if (type === 'card') {
      setCopiedCard(true)
      setTimeout(() => setCopiedCard(false), 2000)
    } else {
      setCopiedUpi(true)
      setTimeout(() => setCopiedUpi(false), 2000)
    }
  }

  const handlePay = async () => {
    setStep('paying')
    setMessage('')

    try {
      // 1. Ask backend to create a Razorpay order
      const { data: order } = await api.post('/payments/create-order', {
        item_type:        'PROPERTY',
        item_id:          tenant.property_id,
        transaction_type: 'RENT',
        amount:           amount,
      })

      // 2. Open Razorpay checkout popup
      const options = {
        key:         import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:      Math.round(amount * 100),   // paise
        currency:    'INR',
        name:        'RentFlow',
        description: `Rent payment — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        order_id:    order.payment_gateway_order_id,  // Razorpay order ID
        prefill: {
          name:    tenant.name,
          email:   tenant.email  || '',
          contact: tenant.phone  || '',
        },
        theme: { color: '#4f46e5' },   // indigo

        // ── On payment SUCCESS ──────────────────────────────────────
        handler: async (response) => {
          try {
            // 3. Verify signature on backend & log payment in DB
            await api.post('/payments/webhook', {
              order_id:            order.id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              status:              'success',
            })
            setPaymentId(response.razorpay_payment_id)
            setStep('success')
            if (onSuccess) onSuccess(response)
          } catch (err) {
            setMessage(err.response?.data?.detail || 'Payment verification failed.')
            setStep('error')
          }
        },
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded. Check your internet connection.')
      }

      const rzp = new window.Razorpay(options)

      // ── On payment FAILURE / dismiss ────────────────────────────
      rzp.on('payment.failed', async (response) => {
        try {
          await api.post('/payments/webhook', {
            order_id: order.id,
            status:   'failed',
          })
        } catch { /* best-effort */ }
        setMessage(response.error?.description || 'Payment was not completed. Make sure to use test card/UPI details.')
        setStep('error')
      })

      rzp.open()

    } catch (err) {
      setMessage(err.message || err.response?.data?.detail || 'Could not initiate payment.')
      setStep('error')
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-primary)]"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            Online Rent Checkout
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Confirm step ─────────────────────────────────────── */}
          {step === 'confirm' && (
            <>
              <div className="bg-[var(--color-surface-dark)] rounded-xl p-4 space-y-2 border border-[var(--color-border)]">
                <Row label="Tenant"       value={tenant.name} />
                <Row label="Billing Month" value={new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} />
                <div className="border-t border-[var(--color-border)] pt-2 flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">Total Payable</span>
                  <span className="text-xl font-bold text-[var(--color-text)]">
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* ── Test Mode Helper ── */}
              <div className="rounded-xl bg-amber-950/40 border border-amber-600/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    ⚡ Razorpay Test Mode Credentials
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-800/60 text-amber-200">Test Only</span>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  Real bank cards will <span className="text-amber-400 font-semibold">fail</span> in test mode. Use these verified test credentials:
                </p>

                {/* Domestic Visa Test Card */}
                <div className="bg-[var(--color-surface-dark)] rounded-lg p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">DOMESTIC VISA TEST CARD</span>
                    <span className="font-mono text-emerald-400 font-semibold tracking-wider">4718 6091 0820 4366</span>
                    <span className="text-[var(--color-text-muted)] text-[10px] ml-2">(Exp: 12/28 · CVV: 123)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('4718609108204366', 'card')}
                    className="p-1.5 rounded bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1 text-[11px]"
                    title="Copy Card Number"
                  >
                    {copiedCard ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </div>

                {/* Domestic MasterCard Test Card */}
                <div className="bg-[var(--color-surface-dark)] rounded-lg p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">DOMESTIC MASTERCARD TEST CARD</span>
                    <span className="font-mono text-cyan-300 font-semibold tracking-wider">5104 0600 0000 0008</span>
                    <span className="text-[var(--color-text-muted)] text-[10px] ml-2">(Exp: 12/28 · CVV: 123)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('5104060000000008', 'card2')}
                    className="p-1.5 rounded bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1 text-[11px]"
                    title="Copy Card Number"
                  >
                    ⎘ Copy
                  </button>
                </div>

                {/* Test UPI */}
                <div className="bg-[var(--color-surface-dark)] rounded-lg p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">TEST UPI ID (INSTANT SUCCESS)</span>
                    <span className="font-mono text-indigo-300 font-semibold">success@razorpay</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('success@razorpay', 'upi')}
                    className="p-1.5 rounded bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1 text-[11px]"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </div>

                <p className="text-[10px] text-[var(--color-text-muted)]">
                  💡 You can also choose <strong className="text-amber-300">Netbanking</strong> (pick any bank) or <strong className="text-indigo-300">UPI</strong>, then click the green <strong className="text-emerald-400">"Success"</strong> button.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm hover:bg-[var(--color-surface-light)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  Proceed to Pay
                </button>
              </div>
            </>
          )}

          {/* ── Paying step ──────────────────────────────────────── */}
          {step === 'paying' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-9 h-9 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[var(--color-text)] font-medium">Opening Razorpay Gateway…</p>
              <p className="text-[var(--color-text-muted)] text-xs max-w-xs mx-auto">
                Complete payment in the Razorpay popup using test card <code className="text-emerald-400">4718 6091 0820 4366</code> or UPI <code className="text-indigo-400">success@razorpay</code>.
              </p>
            </div>
          )}

          {/* ── Success step ─────────────────────────────────────── */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <p className="text-[var(--color-text)] font-semibold text-lg">Payment Successful! 🎉</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">
                  ₹{Number(amount).toLocaleString('en-IN')} received for {tenant.name}
                </p>
                {paymentId && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2 font-mono bg-[var(--color-surface-dark)] py-1 px-2 rounded inline-block">
                    Transaction ID: {paymentId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[var(--color-success)] hover:opacity-90 text-white font-semibold text-sm transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* ── Error step ───────────────────────────────────────── */}
          {step === 'error' && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">❌</div>
              <div>
                <p className="text-[var(--color-text)] font-semibold">Payment Failed</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1.5 px-4">{message}</p>
                <p className="text-[var(--color-text-muted)] text-[11px] mt-2">
                  Remember: real cards fail in test mode. Use card <strong className="text-emerald-400">4718 6091 0820 4366</strong> or UPI <strong className="text-indigo-400">success@razorpay</strong>.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white text-xs font-semibold transition-colors"
                >
                  Try Again with Test Card
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs hover:bg-[var(--color-surface-light)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/** Small helper row for the confirmation summary */
function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--color-text)] font-medium">{value}</span>
    </div>
  )
}
