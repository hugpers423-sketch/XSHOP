// apps/web/lib/realtime.ts
// Cliente Socket.io + fallback local para el modo demo.
// Con NEXT_PUBLIC_SOCKET_URL usa el servidor realtime; sin él, la demo
// sigue siendo funcional para likes, comentarios y rafraîchos de estado.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

function realtimeConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SOCKET_URL);
}

export function getRealtimeSocket(): Socket | null {
  if (!realtimeConfigured()) return null;
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });
  }
  return socket;
}

export interface RTMessage {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sharedProductId?: string;
}

interface UseChatOptions {
  chatId: string;
  userId: string;
  onMessage?: (msg: RTMessage) => void;
}

export function useChatRoom({ chatId, userId, onMessage }: UseChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(!realtimeConfigured());
  const [peerTyping, setPeerTyping] = useState(false);

  useEffect(() => {
    const sock = getRealtimeSocket();
    if (!sock) return;
    socketRef.current = sock;

    const handleMessage = (msg: RTMessage) => {
      if (msg.senderId !== userId) onMessage?.(msg);
    };
    const handleTyping = ({ userId: uid }: { userId: string }) => {
      if (uid !== userId) {
        setPeerTyping(true);
        window.setTimeout(() => setPeerTyping(false), 2500);
      }
    };
    const onConnect = () => {
      setConnected(true);
      sock.emit('chat:join', { chatId });
    };
    const onDisconnect = () => setConnected(false);

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('chat:message', handleMessage);
    sock.on('chat:typing', handleTyping);
    if (sock.connected) onConnect();

    return () => {
      sock.emit('chat:leave', { chatId });
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('chat:message', handleMessage);
      sock.off('chat:typing', handleTyping);
    };
  }, [chatId, userId, onMessage]);

  const send = useCallback(
    (content: string, sharedProductId?: string) => {
      const text = content.trim();
      if (!text) return;
      socketRef.current?.emit('chat:send', {
        chatId,
        message: { senderId: userId, content: text, sharedProductId },
      });
    },
    [chatId, userId]
  );

  const typing = useCallback(() => {
    socketRef.current?.emit('chat:typing', { chatId, userId });
  }, [chatId, userId]);

  return { connected, send, typing, peerTyping };
}

export interface LiveComment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

const DEMO_LIVE_COMMENTS: LiveComment[] = [
  { id: 'demo-1', userId: 'lucia_m', text: '¿Llega a Arequipa? 😍', createdAt: new Date().toISOString() },
  { id: 'demo-2', userId: 'carlos99', text: 'Lo tomé, ya pagué ✅', createdAt: new Date().toISOString() },
  { id: 'demo-3', userId: 'sofia_trends', text: 'El color morado ¿tiene stock?', createdAt: new Date().toISOString() },
];

interface UseLiveOptions {
  streamId: string;
  userId?: string;
  demo?: boolean;
}

export function useLiveRoom({ streamId, userId = 'guest', demo = true }: UseLiveOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [comments, setComments] = useState<LiveComment[]>(demo ? DEMO_LIVE_COMMENTS : []);
  const [likes, setLikes] = useState(0);
  const [viewers, setViewers] = useState(1243);
  const [pinned, setPinned] = useState<string | null>(null);
  const [connected, setConnected] = useState(!realtimeConfigured());

  useEffect(() => {
    setComments(demo ? DEMO_LIVE_COMMENTS : []);
    setLikes(0);
    setViewers(1243);
    setPinned(null);
  }, [demo, streamId]);

  useEffect(() => {
    const sock = getRealtimeSocket();
    if (!sock) return;
    socketRef.current = sock;

    const onState = (st: { comments: LiveComment[]; likes: number; pinned: string | null; viewers: number }) => {
      setComments(st.comments);
      setLikes(st.likes);
      setPinned(st.pinned);
      setViewers(st.viewers);
    };
    const onComment = (comment: LiveComment) => setComments((prev) => [...prev.slice(-99), comment]);
    const onLikes = (value: number) => setLikes(value);
    const onViewers = (value: number) => setViewers(value);
    const onPin = (value: string | null) => setPinned(value);
    const onConnect = () => {
      setConnected(true);
      sock.emit('live:join', { streamId, userId });
    };
    const onDisconnect = () => setConnected(false);

    sock.on('connect', onConnect);
    sock.on('disconnect', onDisconnect);
    sock.on('live:state', onState);
    sock.on('live:comment', onComment);
    sock.on('live:likes', onLikes);
    sock.on('live:viewers', onViewers);
    sock.on('live:pin', onPin);
    if (sock.connected) onConnect();

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('live:state', onState);
      sock.off('live:comment', onComment);
      sock.off('live:likes', onLikes);
      sock.off('live:viewers', onViewers);
      sock.off('live:pin', onPin);
    };
  }, [streamId, userId]);

  const comment = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value) return;
      const entry: LiveComment = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        text: value,
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev.slice(-99), entry]);
      socketRef.current?.emit('live:comment', { streamId, userId, text: value });
    },
    [streamId, userId]
  );

  const like = useCallback(() => {
    setLikes((value) => value + 1);
    socketRef.current?.emit('live:like', { streamId });
  }, [streamId]);

  const pin = useCallback(
    (productId: string | null) => {
      setPinned(productId);
      socketRef.current?.emit('live:pin', { streamId, productId });
    },
    [streamId]
  );

  return { connected, comments, likes, viewers, pinned, comment, like, pin };
}
