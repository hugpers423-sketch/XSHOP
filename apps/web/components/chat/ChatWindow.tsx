// apps/web/components/chat/ChatWindow.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatRoom } from '@/lib/realtime';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sharedProductId?: string;
}

interface ChatWindowProps {
  peerName: string;
  peerAvatar: string;
  productId?: string;
  productTitle?: string;
  currentUserId: string;
  /** Si se provee, usa Socket.io real; si no, fallback con respuestas simuladas */
  chatId?: string;
  onSend?: (content: string) => void;
}

/**
 * Chat comprador ↔ vendedor estilo WhatsApp/Messenger:
 * - Burbujas con animación de entrada
 * - Typing indicator (tiempo real vía Socket.io)
 * - Card de producto compartido
 * - Input con envío por Enter
 */
export function ChatWindow({
  peerName, peerAvatar, productTitle, currentUserId, chatId, onSend,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(() => [
    // Inicialización perezosa: Date.now() solo una vez (regla react-hooks/purity)
    { id: '1', senderId: 'peer', content: '¡Hola! 👋 Sí, tengo stock disponible.', createdAt: new Date(Date.now() - 300000) },
    { id: '2', senderId: currentUserId, content: '¿Llega a San Isidro?', createdAt: new Date(Date.now() - 240000) },
    { id: '3', senderId: 'peer', content: 'Sí, con envío gratis llega mañana 🚚', createdAt: new Date(Date.now() - 120000) },
  ]);
  const [draft, setDraft] = useState('');
  const [simTyping, setSimTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sala de tiempo real (inactiva si no hay chatId)
  const { send: rtSend, typing: rtTyping, peerTyping, connected } = useChatRoom({
    chatId: chatId ?? '',
    userId: currentUserId,
    onMessage: (msg) =>
      setMessages((prev) => [
        ...prev,
        { ...msg, createdAt: new Date(msg.createdAt) },
      ]),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping, simTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    const msg: Message = {
      id: String(Date.now()),
      senderId: currentUserId,
      content: text,
      createdAt: new Date(),
    };

    // Optimista: siempre insertar localmente
    setMessages((prev) => [...prev, msg]);
    setDraft('');
    onSend?.(text);

    if (chatId && connected) {
      rtSend(text); // el socket hace echo/broadcast
      return;
    }

    // Fallback demo sin backend: respuesta simulada del vendedor
    setSimTyping(true);
    setTimeout(() => {
      setSimTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          senderId: 'peer',
          content: 'Perfecto, te reservo el producto ✅',
          createdAt: new Date(),
        },
      ]);
    }, 1800);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (chatId && connected && value && !draft) rtTyping(); // emitir typing solo al primer char
  };

  const showTyping = chatId ? peerTyping : simTyping;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-zinc-950">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <img
          src={peerAvatar || '/img/default-avatar.png'}
          alt={peerName}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{peerName}</p>
          <p className="text-[11px] text-emerald-400">● en línea</p>
        </div>
        {productTitle && (
          <span className="max-w-[140px] truncate rounded-full bg-cyan-500/15 px-3 py-1 text-[10px] font-bold text-cyan-300">
            📦 {productTitle}
          </span>
        )}
      </header>

      {/* Mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMine
                      ? 'rounded-br-md bg-gradient-to-r from-cyan-500 to-violet-600 text-white'
                      : 'rounded-bl-md bg-white/10 text-white'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      isMine ? 'text-white/60' : 'text-white/40'
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {showTyping && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white/10 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/60"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-white/10 p-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button type="button" aria-label="Adjuntar" className="text-xl text-white/50 hover:text-white">
          📎
        </button>
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={500}
          className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Enviar"
          className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white transition active:scale-95 disabled:opacity-40"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
