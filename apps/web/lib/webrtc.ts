'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getRealtimeSocket } from './realtime';

type WebRTCMode = 'publisher' | 'viewer';

interface UseLiveWebRTCOptions {
  streamId: string;
  mode: WebRTCMode;
  enabled?: boolean;
}

interface SignalPayload {
  streamId?: string;
  viewerId?: string;
  publisherId?: string;
  targetId?: string;
  fromId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    ...(turnUrl
      ? [{
          urls: turnUrl,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        }]
      : []),
  ],
  bundlePolicy: 'max-bundle',
};

/**
 * Señalización WebRTC mínima para el modo cámara del estudio local.
 * El video/audio viaja por WebRTC; Socket.IO solo intercambia ofertas,
 * respuestas y candidatos ICE. En producción se debe añadir TURN y/o
 * sustituir el adaptador por Mux/LiveKit para Sales fuera de la red local.
 */
export function useLiveWebRTC({ streamId, mode, enabled = true }: UseLiveWebRTCOptions) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof getRealtimeSocket>>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamIdRef = useRef(streamId);
  const modeRef = useRef(mode);

  useEffect(() => {
    streamIdRef.current = streamId;
    modeRef.current = mode;
    setRemoteStream(null);
    setViewerCount(0);
  }, [mode, streamId]);

  const createPeer = useCallback((peerId: string, localStream: MediaStream | null) => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      setError('Este navegador no soporta WebRTC.');
      return null;
    }

    const existing = peersRef.current.get(peerId);
    if (existing) return existing;

    const peer = new RTCPeerConnection(RTC_CONFIG);
    if (localStream) {
      for (const track of localStream.getTracks()) peer.addTrack(track, localStream);
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit('live:ice-candidate', {
        streamId: streamIdRef.current,
        targetId: peerId,
        candidate: event.candidate.toJSON(),
      });
    };
    peer.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStream(stream);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setConnected(true);
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        setConnected(false);
      }
    };
    peersRef.current.set(peerId, peer);
    return peer;
  }, []);

  useEffect(() => {
    if (!enabled || !streamId || typeof window === 'undefined') return;
    const socket = getRealtimeSocket();
    socketRef.current = socket;
    if (!socket) {
      setError('Socket.IO no está configurado; se usará el fallback local.');
      setConnected(false);
      return;
    }

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onPublisherOnline = (payload: { streamId?: string; publisherId?: string }) => {
      if (mode !== 'viewer' || payload.streamId !== streamId) return;
      setConnected(true);
      socket.emit('live:viewer-ready', { streamId });
    };
    const onPublisherOffline = (payload: { streamId?: string }) => {
      if (mode === 'viewer' && payload.streamId === streamId) {
        setRemoteStream(null);
        setConnected(false);
      }
    };
    const onViewerReady = async (payload: { streamId?: string; viewerId?: string }) => {
      if (mode !== 'publisher' || payload.streamId !== streamId || !payload.viewerId) return;
      const localStream = localStreamRef.current;
      if (!localStream) return;
      const peer = createPeer(payload.viewerId, localStream);
      if (!peer) return;
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('live:offer', {
        streamId,
        targetId: payload.viewerId,
        sdp: peer.localDescription,
      });
      setViewerCount((count) => count + 1);
    };
    const onViewerLeft = (payload: { streamId?: string; viewerId?: string }) => {
      if (mode !== 'publisher' || payload.streamId !== streamId || !payload.viewerId) return;
      peersRef.current.get(payload.viewerId)?.close();
      peersRef.current.delete(payload.viewerId);
      setViewerCount((count) => Math.max(0, count - 1));
    };
    const onOffer = async (payload: SignalPayload) => {
      if (mode !== 'viewer' || payload.streamId !== streamId || !payload.publisherId || !payload.sdp) return;
      const peer = createPeer(payload.publisherId, null);
      if (!peer) return;
      await peer.setRemoteDescription(payload.sdp);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('live:answer', {
        streamId,
        targetId: payload.publisherId,
        sdp: peer.localDescription,
      });
    };
    const onAnswer = async (payload: SignalPayload) => {
      if (mode !== 'publisher' || payload.streamId !== streamId || !payload.viewerId || !payload.sdp) return;
      const peer = peersRef.current.get(payload.viewerId);
      if (peer) await peer.setRemoteDescription(payload.sdp);
    };
    const onIceCandidate = async (payload: SignalPayload) => {
      if (payload.streamId !== streamId || !payload.candidate) return;
      const peerId = mode === 'publisher' ? payload.fromId : payload.publisherId;
      if (!peerId) return;
      const peer = peersRef.current.get(peerId);
      if (peer) await peer.addIceCandidate(payload.candidate).catch(() => undefined);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('live:publisher-online', onPublisherOnline);
    socket.on('live:publisher-offline', onPublisherOffline);
    socket.on('live:viewer-ready', onViewerReady);
    socket.on('live:viewer-left', onViewerLeft);
    socket.on('live:offer', onOffer);
    socket.on('live:answer', onAnswer);
    socket.on('live:ice-candidate', onIceCandidate);

    if (socket.connected) {
      setConnected(true);
      if (mode === 'viewer') socket.emit('live:viewer-ready', { streamId });
    } else {
      socket.once('connect', () => {
        if (mode === 'viewer') socket.emit('live:viewer-ready', { streamId });
      });
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('live:publisher-online', onPublisherOnline);
      socket.off('live:publisher-offline', onPublisherOffline);
      socket.off('live:viewer-ready', onViewerReady);
      socket.off('live:viewer-left', onViewerLeft);
      socket.off('live:offer', onOffer);
      socket.off('live:answer', onAnswer);
      socket.off('live:ice-candidate', onIceCandidate);
    };
  }, [createPeer, enabled, mode, streamId]);

  useEffect(() => {
    if (mode !== 'publisher' || !publishing || !streamId || !localStreamRef.current) return;
    const socket = getRealtimeSocket();
    socket?.emit('live:publish', { streamId, userId: 'seller' });
  }, [mode, publishing, streamId]);

  const startPublishing = useCallback((nextStreamId: string, stream: MediaStream) => {
    streamIdRef.current = nextStreamId;
    localStreamRef.current = stream;
    setPublishing(true);
    setError(null);
    const socket = getRealtimeSocket();
    if (socket) socket.emit('live:publish', { streamId: nextStreamId, userId: 'seller' });
  }, []);

  const stopPublishing = useCallback(() => {
    const socket = getRealtimeSocket();
    if (socket && publishing) socket.emit('live:publish-stop', { streamId: streamIdRef.current });
    for (const peer of peersRef.current.values()) peer.close();
    peersRef.current.clear();
    setPublishing(false);
    setViewerCount(0);
  }, [publishing]);

  return {
    remoteStream,
    publishing,
    connected,
    viewerCount,
    error,
    startPublishing,
    stopPublishing,
  };
}
