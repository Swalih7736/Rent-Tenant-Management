import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/Toast';
import {
    fetchConversations,
    fetchMessages,
    sendMessage,
    respondToOffer,
} from '../api';

export default function ChatPage() {
    const { user } = useAuth();
    const toast = useToast();
    const location = useLocation();
    const messagesEndRef = useRef(null);

    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingConvs, setLoadingConvs] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);

    // Message sending input
    const [typedMessage, setTypedMessage] = useState('');
    const [customOffer, setCustomOffer] = useState('');
    const [showOfferInput, setShowOfferInput] = useState(false);
    const [sending, setSending] = useState(false);

    // Initial load of conversations
    useEffect(() => {
        async function load() {
            setLoadingConvs(true);
            try {
                const list = await fetchConversations();
                setConversations(list);
                
                // If redirected from details page with a selected conversation ID
                const targetId = location.state?.selectedConvId;
                if (targetId) {
                    const match = list.find(c => c.id === targetId);
                    if (match) setSelectedConv(match);
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load chats.');
            } finally {
                setLoadingConvs(false);
            }
        }
        load();
    }, [location.state?.selectedConvId, toast]);

    // Load messages when conversation changes
    useEffect(() => {
        if (!selectedConv) return;
        
        async function loadMessages() {
            setLoadingMsgs(true);
            try {
                const msgs = await fetchMessages(selectedConv.id);
                setMessages(msgs);
            } catch (err) {
                console.error(err);
                toast.error('Failed to fetch messages.');
            } finally {
                setLoadingMsgs(false);
            }
        }
        loadMessages();

        // Simple polling for new messages every 5 seconds
        const interval = setInterval(async () => {
            try {
                const msgs = await fetchMessages(selectedConv.id);
                setMessages(msgs);
            } catch (err) {
                console.error('Polling error', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedConv, toast]);

    // Scroll to bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!typedMessage.trim() && !customOffer.trim()) return;
        setSending(true);
        try {
            const payload = {
                message: typedMessage,
            };
            if (showOfferInput && customOffer) {
                payload.offer_amount = Number(customOffer);
                payload.message = typedMessage || `Hi, I am submitting a counter-offer of $${Number(customOffer).toLocaleString()}.`;
            }
            const newMsg = await sendMessage(selectedConv.id, payload);
            setMessages(prev => [...prev, newMsg]);
            setTypedMessage('');
            setCustomOffer('');
            setShowOfferInput(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    const handleRespondOffer = async (msgId, status) => {
        try {
            await respondToOffer(msgId, { offer_status: status });
            toast.success(`Offer ${status.toLowerCase()}ed successfully!`);
            // Refresh
            const msgs = await fetchMessages(selectedConv.id);
            setMessages(msgs);
        } catch (err) {
            console.error(err);
            toast.error('Failed to update offer status.');
        }
    };

    return (
        <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col animate-fade-in-up">
            <div className="border-b border-[var(--color-border)]/60 pb-3">
                <h1 className="text-3xl font-extrabold tracking-tight text-white">
                    Negotiation <span className="gold-gradient-text">Messenger</span>
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Direct real-time negotiations and counter-offers with property owners and buyers.
                </p>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-0 glass-card rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-border)]">
                
                {/* Sidebar - Conversation List */}
                <div className="md:col-span-4 border-r border-[var(--color-border)]/60 flex flex-col h-full bg-[var(--color-surface-dark)]/80">
                    <div className="p-4 border-b border-[var(--color-border)]/60 flex items-center justify-between">
                        <span className="font-bold text-xs tracking-wider uppercase text-[var(--color-primary)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                            Active Threads
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-0.5 rounded-md border border-[var(--color-border)]">
                            {conversations.length}
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/30">
                        {loadingConvs ? (
                            <div className="flex py-12 justify-center">
                                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-8 text-center text-xs text-[var(--color-text-muted)] space-y-2">
                                <div className="text-3xl">💬</div>
                                <p>No active negotiations yet.</p>
                            </div>
                        ) : (
                            conversations.map((conv) => {
                                const isBuyer = user?.id === conv.buyer_id;
                                const otherParticipant = isBuyer ? conv.seller : conv.buyer;
                                const otherName = otherParticipant?.full_name || otherParticipant?.email || 'Unknown User';
                                const active = selectedConv?.id === conv.id;

                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => setSelectedConv(conv)}
                                        className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 focus:outline-none relative ${
                                            active 
                                                ? 'bg-gradient-to-r from-[var(--color-primary)]/15 to-transparent border-l-4 border-l-[var(--color-primary)] text-white' 
                                                : 'hover:bg-white/[0.03] text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-primary)]">
                                                    {otherName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-sm text-white line-clamp-1">{otherName}</span>
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-muted)]">{new Date(conv.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <span className="text-xs text-[var(--color-primary)] font-medium line-clamp-1 pl-9">
                                            🏢 {conv.listing?.title || 'Listing Detail'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="md:col-span-8 flex flex-col h-full bg-[var(--color-surface)]/60">
                    {selectedConv ? (
                        <>
                            {/* Selected Chat Header */}
                            <div className="p-4 border-b border-[var(--color-border)]/60 bg-[var(--color-surface-dark)]/90 backdrop-blur-md flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/20 to-amber-600/20 border border-[var(--color-primary)]/40 flex items-center justify-center font-bold text-sm text-[var(--color-primary)] shadow-sm">
                                        {(user?.id === selectedConv.buyer_id ? selectedConv.seller?.full_name : selectedConv.buyer?.full_name)?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-white">
                                            {user?.id === selectedConv.buyer_id ? selectedConv.seller?.full_name : selectedConv.buyer?.full_name}
                                        </h3>
                                        <p className="text-xs text-[var(--color-primary)] font-medium mt-0.5 flex items-center gap-1.5">
                                            <span>Listing: {selectedConv.listing?.title}</span>
                                            <span className="text-[var(--color-text-muted)]">•</span>
                                            <span className="font-bold text-white">₹{Number(selectedConv.listing?.price || 0).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Message History */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {loadingMsgs ? (
                                    <div className="flex h-full items-center justify-center">
                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const mine = msg.sender_id === user?.id;
                                        const hasOffer = msg.offer_status !== 'NONE';

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                                            >
                                                <div className={`max-w-[75%] rounded-2xl p-4 shadow-lg ${
                                                    mine
                                                        ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/40 text-white rounded-tr-none'
                                                        : 'bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white rounded-tl-none'
                                                }`}>
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                    
                                                    {/* Offer Proposal Render */}
                                                    {hasOffer && (
                                                        <div className="mt-3 p-3.5 rounded-xl bg-black/40 border border-amber-500/30 space-y-2.5 text-xs">
                                                            <div className="flex items-center justify-between gap-4 font-semibold text-white">
                                                                <span className="text-[var(--color-text-muted)]">Formal Proposal:</span>
                                                                <span className="text-[var(--color-primary)] font-bold text-sm">₹{Number(msg.offer_amount || 0).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span className="text-[var(--color-text-muted)]">Status:</span>
                                                                <span className={`font-bold text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                                    msg.offer_status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                                    msg.offer_status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                                }`}>{msg.offer_status}</span>
                                                            </div>
                                                            
                                                            {/* Accept/Reject Counter Actions */}
                                                            {msg.offer_status === 'PENDING' && !mine && (
                                                                <div className="flex gap-2 pt-2 border-t border-white/10">
                                                                    <button
                                                                        onClick={() => handleRespondOffer(msg.id, 'ACCEPTED')}
                                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold py-1.5 px-3 rounded-lg text-xs text-white transition-all shadow-sm"
                                                                    >
                                                                        Accept Offer
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRespondOffer(msg.id, 'REJECTED')}
                                                                        className="flex-1 bg-rose-600 hover:bg-rose-500 font-bold py-1.5 px-3 rounded-lg text-xs text-white transition-all shadow-sm"
                                                                    >
                                                                        Decline
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="block text-[10px] text-[var(--color-text-muted)] text-right mt-2">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Send Input Bar */}
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--color-border)]/60 bg-[var(--color-surface-dark)]/90 backdrop-blur-md space-y-3">
                                {showOfferInput && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 animate-fade-in-up">
                                        <span className="text-xs font-bold text-[var(--color-primary)]">Propose Custom Offer (₹):</span>
                                        <input
                                            type="number"
                                            value={customOffer}
                                            onChange={(e) => setCustomOffer(e.target.value)}
                                            className="w-36 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface-dark)] border border-amber-500/40 text-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] font-bold"
                                            placeholder="e.g. 25000"
                                            required
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOfferInput(!showOfferInput)}
                                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                            showOfferInput
                                                ? 'bg-amber-500/20 border-amber-500 text-[var(--color-primary)] shadow-sm'
                                                : 'glass-card border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
                                        }`}
                                    >
                                        🤝 {showOfferInput ? 'Cancel Offer' : 'Add Offer'}
                                    </button>
                                    <input
                                        type="text"
                                        value={typedMessage}
                                        onChange={(e) => setTypedMessage(e.target.value)}
                                        placeholder={showOfferInput ? "Type details/message alongside your proposal..." : "Type your message..."}
                                        className="flex-1 text-xs px-4 py-2.5 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] placeholder-[var(--color-text-muted)]/60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="gold-glow-btn px-5 py-2.5 text-xs font-bold shrink-0"
                                    >
                                        {sending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-3 p-8">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center text-3xl text-[var(--color-primary)]">
                                💬
                            </div>
                            <p className="text-sm font-semibold text-white">Select a Negotiation Thread</p>
                            <p className="text-xs text-[var(--color-text-muted)] max-w-xs text-center">
                                Pick a conversation from the left sidebar to start negotiating prices or discussing property details.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
