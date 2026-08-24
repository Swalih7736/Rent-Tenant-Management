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
        <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Negotiator Chat</h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Negotiate rent & sales prices directly with property owners and buyers.</p>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden shadow-sm">
                
                {/* Sidebar - Conversation List */}
                <div className="md:col-span-4 border-r border-[var(--color-border)] flex flex-col h-full bg-[var(--color-surface-dark)]/50">
                    <div className="p-4 border-b border-[var(--color-border)] font-bold text-sm tracking-wider uppercase text-[var(--color-text-muted)]">
                        Threads
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                        {loadingConvs ? (
                            <div className="flex py-10 justify-center">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
                                No active negotiations yet.
                            </div>
                        ) : (
                            conversations.map((conv) => {
                                const isBuyer = user.id === conv.buyer_id;
                                const otherParticipant = isBuyer ? conv.seller : conv.buyer;
                                const otherName = otherParticipant?.full_name || otherParticipant?.email || 'Unknown User';
                                const active = selectedConv?.id === conv.id;

                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => setSelectedConv(conv)}
                                        className={`w-full text-left p-4 transition-colors flex flex-col gap-1 focus:outline-none ${
                                            active ? 'bg-[var(--color-primary)]/10 text-white' : 'hover:bg-white/5 text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-semibold text-sm text-white line-clamp-1">{otherName}</span>
                                            <span className="text-[10px] text-white/40">{new Date(conv.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <span className="text-xs text-[var(--color-primary-light)] font-medium line-clamp-1">
                                            🏢 {conv.listing?.title || 'Listing Detail'}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="md:col-span-8 flex flex-col h-full bg-[var(--color-surface)]">
                    {selectedConv ? (
                        <>
                            {/* Selected Chat Header */}
                            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-white">
                                        {user.id === selectedConv.buyer_id ? selectedConv.seller?.full_name : selectedConv.buyer?.full_name}
                                    </h3>
                                    <p className="text-[11px] text-[var(--color-primary-light)] font-medium mt-0.5">
                                        Listing: {selectedConv.listing?.title} (${selectedConv.listing?.price.toLocaleString()})
                                    </p>
                                </div>
                            </div>

                            {/* Message History */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {loadingMsgs ? (
                                    <div className="flex h-full items-center justify-center">
                                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                                    </div>
                                ) : (
                                    messages.map((msg) => {
                                        const mine = msg.sender_id === user.id;
                                        const hasOffer = msg.offer_status !== 'NONE';

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`max-w-[70%] rounded-2xl p-3.5 ${
                                                    mine
                                                        ? 'bg-[var(--color-primary)] text-white rounded-tr-none'
                                                        : 'bg-[var(--color-surface-light)] border border-[var(--color-border)] text-white rounded-tl-none'
                                                }`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                                    
                                                    {/* Offer Proposal Render */}
                                                    {hasOffer && (
                                                        <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/10 space-y-2 text-xs">
                                                            <div className="flex items-center justify-between gap-4 font-semibold text-white">
                                                                <span>Proposed Offer:</span>
                                                                <span className="text-yellow-400 font-bold">${msg.offer_amount.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                                <span>Status:</span>
                                                                <span className={`font-bold uppercase tracking-wider ${
                                                                    msg.offer_status === 'PENDING' ? 'text-blue-400' :
                                                                    msg.offer_status === 'ACCEPTED' ? 'text-emerald-400' : 'text-red-400'
                                                                }`}>{msg.offer_status}</span>
                                                            </div>
                                                            
                                                            {/* Accept/Reject Counter Actions */}
                                                            {msg.offer_status === 'PENDING' && !mine && (
                                                                <div className="flex gap-2 pt-1">
                                                                    <button
                                                                        onClick={() => handleRespondOffer(msg.id, 'ACCEPTED')}
                                                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 font-bold py-1 px-2 rounded-md text-[10px] text-white transition-colors"
                                                                    >
                                                                        Accept
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRespondOffer(msg.id, 'REJECTED')}
                                                                        className="flex-1 bg-red-500 hover:bg-red-600 font-bold py-1 px-2 rounded-md text-[10px] text-white transition-colors"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <span className="block text-[9px] text-white/50 text-right mt-1.5">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Send Input Bar */}
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-dark)]/30 space-y-3">
                                {showOfferInput && (
                                    <div className="flex items-center gap-2 max-w-xs animate-in slide-in-from-bottom duration-150">
                                        <span className="text-xs font-semibold text-[var(--color-text-muted)]">Offer Amount ($):</span>
                                        <input
                                            type="number"
                                            value={customOffer}
                                            onChange={(e) => setCustomOffer(e.target.value)}
                                            className="w-28 text-xs px-2.5 py-1.5 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none"
                                            placeholder="Propose custom..."
                                            required
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOfferInput(!showOfferInput)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                            showOfferInput
                                                ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                                                : 'bg-[var(--color-surface-dark)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
                                        }`}
                                    >
                                        🤝 {showOfferInput ? 'Remove Offer' : 'Add Offer'}
                                    </button>
                                    <input
                                        type="text"
                                        value={typedMessage}
                                        onChange={(e) => setTypedMessage(e.target.value)}
                                        placeholder={showOfferInput ? "Type details/message alongside your offer..." : "Type a message..."}
                                        className="flex-1 text-xs px-4 py-2.5 rounded-xl bg-[var(--color-surface-dark)] border border-[var(--color-border)] text-white focus:outline-none focus:border-[var(--color-primary)]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                                    >
                                        Send
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] gap-2">
                            <span className="text-3xl">💬</span>
                            <p className="text-xs">Select a conversation thread to start negotiating</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
