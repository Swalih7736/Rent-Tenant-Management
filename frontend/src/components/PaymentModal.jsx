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
export default function PaymentModal({ tenant, property, amount, monthCovered, onClose, onSuccess }) {
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
        prefill: {
          name:    tenant.name,
          email:   tenant.email  || '',
          contact: tenant.phone  || '',
        },
        theme: { color: '#f59e0b' },   // amber/gold
      }

      if (order.payment_gateway_order_id && !order.payment_gateway_order_id.startsWith('rzp_fallback_')) {
        options.order_id = order.payment_gateway_order_id
      }

      // ── On payment SUCCESS ──────────────────────────────────────
      options.handler = async (response) => {
          try {
            const targetMonth = monthCovered || new Date().toISOString().slice(0, 7);
            // 3. Verify signature on backend & log payment in DB
            await api.post('/payments/webhook', {
              order_id:            order.id,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              status:              'success',
              tenant_id:           tenant.id,
              month_covered:       targetMonth,
            })
            setPaymentId(response.razorpay_payment_id)
            setStep('success')
            if (onSuccess) onSuccess(response)
          } catch (err) {
            setMessage(err.response?.data?.detail || 'Payment verification failed.')
            setStep('error')
          }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-4">
      <div className="bg-[var(--color-surface)]/95 rounded-3xl border border-amber-500/25 w-full max-w-md shadow-2xl shadow-black/80 overflow-hidden animate-fade-in-up">
        {/* Top gold line */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-dark)]/40">
          <h2 className="font-bold text-white text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            Online Rent Checkout
          </h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-white transition-colors cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Confirm step ─────────────────────────────────────── */}
          {step === 'confirm' && (
            <>
              <div className="bg-[var(--color-surface-dark)] rounded-2xl p-4 space-y-2 border border-[var(--color-border)]">
                <Row label="Tenant"       value={tenant.name} />
                <Row label="Property"     value={property?.address || tenant.property_address || 'Rental Unit'} />
                <Row label="Billing Month" value={monthCovered ? new Date(`${monthCovered}-01`).toLocaleString('default', { month: 'long', year: 'numeric' }) : new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} />
                <div className="border-t border-[var(--color-border)] pt-2 flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)] font-semibold">Total Payable</span>
                  <span className="text-xl font-black text-amber-400">
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* ── Test Mode Helper ── */}
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    ⚡ Razorpay Test Mode Credentials
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Test Only</span>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  Real bank cards will <span className="text-amber-400 font-semibold">fail</span> in test mode. Use these verified test credentials:
                </p>

                {/* Domestic Visa Test Card */}
                <div className="bg-[var(--color-surface-dark)] rounded-xl p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">DOMESTIC VISA TEST CARD</span>
                    <span className="font-mono text-emerald-400 font-semibold tracking-wider">4100 2800 0000 1007</span>
                    <span className="text-[var(--color-text-muted)] text-[10px] ml-2">(Exp: 12/28 · CVV: 123)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('4100280000001007', 'card')}
                    className="p-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-amber-400 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Copy Card Number"
                  >
                    {copiedCard ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </div>

                {/* Domestic MasterCard Test Card */}
                <div className="bg-[var(--color-surface-dark)] rounded-xl p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">DOMESTIC MASTERCARD TEST CARD</span>
                    <span className="font-mono text-amber-300 font-semibold tracking-wider">5555 5100 0008 1006</span>
                    <span className="text-[var(--color-text-muted)] text-[10px] ml-2">(Exp: 12/28 · CVV: 123)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('5555510000081006', 'card2')}
                    className="p-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-amber-400 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Copy Card Number"
                  >
                    ⎘ Copy
                  </button>
                </div>

                {/* Test UPI */}
                <div className="bg-[var(--color-surface-dark)] rounded-xl p-2.5 border border-[var(--color-border)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--color-text-muted)] block text-[10px]">TEST UPI ID (INSTANT SUCCESS)</span>
                    <span className="font-mono text-amber-300 font-semibold">success@razorpay</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('success@razorpay', 'upi')}
                    className="p-1.5 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-light)] text-amber-400 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? '✓ Copied' : '⎘ Copy'}
                  </button>
                </div>

                <p className="text-[10px] text-[var(--color-text-muted)]">
                  💡 You can also choose <strong className="text-amber-300">Netbanking</strong> (pick any bank) or <strong className="text-amber-300">UPI</strong>, then click the green <strong className="text-emerald-400">"Success"</strong> button.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-bold hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  className="flex-1 py-2.5 rounded-xl gold-glow-btn text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
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
              <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white font-bold text-sm">Opening Razorpay Gateway…</p>
              <p className="text-[var(--color-text-muted)] text-xs max-w-xs mx-auto">
                Complete payment in the Razorpay popup using test card <code className="text-emerald-400">4100 2800 0000 1007</code> or UPI <code className="text-amber-300">success@razorpay</code>.
              </p>
            </div>
          )}

          {/* ── Success step ─────────────────────────────────────── */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <p className="text-white font-bold text-lg">Payment Successful! 🎉</p>
                <p className="text-[var(--color-text-muted)] text-sm mt-1">
                  ₹{Number(amount).toLocaleString('en-IN')} received for {tenant.name}
                </p>
                {paymentId && (
                  <p className="text-xs text-amber-300 mt-2 font-mono bg-[var(--color-surface-dark)] py-1 px-3 rounded-lg border border-[var(--color-border)] inline-block">
                    Transaction ID: {paymentId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
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
                <p className="text-rose-400 font-bold">Payment Failed</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1.5 px-4">{message}</p>
                <p className="text-[var(--color-text-muted)] text-[11px] mt-2">
                  Remember: real cards fail in test mode. Use card <strong className="text-emerald-400">4100 2800 0000 1007</strong> or UPI <strong className="text-amber-300">success@razorpay</strong>.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  className="px-5 py-2 rounded-xl gold-glow-btn text-xs font-bold transition-colors cursor-pointer"
                >
                  Try Again with Test Card
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs font-semibold hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
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
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--color-text-muted)] font-semibold">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  )
}
