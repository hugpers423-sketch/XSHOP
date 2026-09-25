'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from 'livekit-client';

const AUDIO_TOPIC = 'xshop-audio-invite';
const MAX_AUDIO_MESSAGE_BYTES = 16 * 1024;
type LiveKitBytes = Uint8Array<ArrayBuffer>;

type TokenMode = 'publisher' | 'viewer' | 'speaker';

interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
  identity: string;
}

export interface LiveKitParticipant {
  identity: string;
  name: string;
  audioEnabled: boolean;
  isSpeaking: boolean;
  inviteState: 'none' | 'pending' | 'active';
}

export interface LiveAudioInvite {
  token: string;
  fromIdentity: string;
  fromName?: string;
  expiresAt: number;
}

type AudioControlMessage =
  | { type: 'audio-invite'; token: string; expiresAt: number }
  | { type: 'audio-accepted' | 'audio-declined' | 'audio-ended'; toIdentity?: string };

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function jsonError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return fallback;
}

async function requestToken(
  roomName: string,
  mode: TokenMode,
  inviteToken?: string,
): Promise<TokenResponse> {
  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ roomName, mode, ...(inviteToken ? { inviteToken } : {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(jsonError(data, 'No se pudo obtener el token de LiveKit'));
  if (
    !data
    || typeof data !== 'object'
    || typeof data.token !== 'string'
    || typeof data.url !== 'string'
    || typeof data.identity !== 'string'
  ) {
    throw new Error('LiveKit devolvió una respuesta inválida');
  }
  return data as TokenResponse;
}

function encodeAudioMessage(message: AudioControlMessage): LiveKitBytes {
  return Uint8Array.from(new TextEncoder().encode(JSON.stringify(message)));
}

function parseAudioMessage(payload: LiveKitBytes, topic?: string): AudioControlMessage | null {
  if (topic !== AUDIO_TOPIC || payload.byteLength > MAX_AUDIO_MESSAGE_BYTES) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    if (value.type === 'audio-invite') {
      if (typeof value.token !== 'string' || typeof value.expiresAt !== 'number') return null;
      if (!Number.isFinite(value.expiresAt)) return null;
      return { type: 'audio-invite', token: value.token, expiresAt: value.expiresAt };
    }
    if (value.type === 'audio-accepted' || value.type === 'audio-declined' || value.type === 'audio-ended') {
      return {
        type: value.type,
        ...(typeof value.toIdentity === 'string' ? { toIdentity: value.toIdentity } : {}),
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function publishAudioMessage(
  room: Room,
  message: AudioControlMessage,
  destinationIdentities?: string[],
): Promise<void> {
  await room.localParticipant.publishData(encodeAudioMessage(message), {
    topic: AUDIO_TOPIC,
    reliable: true,
    ...(destinationIdentities?.length ? { destinationIdentities } : {}),
  });
}

function participantSummary(
  participant: RemoteParticipant,
  pendingInvites: Set<string>,
  activeAudio: Set<string>,
): LiveKitParticipant {
  const audioEnabled = participant.isMicrophoneEnabled;
  return {
    identity: participant.identity,
    name: participant.name || 'Comprador',
    audioEnabled,
    isSpeaking: participant.isSpeaking,
    inviteState: activeAudio.has(participant.identity) || audioEnabled
      ? 'active'
      : pendingInvites.has(participant.identity)
        ? 'pending'
        : 'none',
  };
}

export function useLiveKitPublisher() {
  const roomRef = useRef<Room | null>(null);
  const roomNameRef = useRef('');
  const remoteAudioTracksRef = useRef<Map<string, MediaStreamTrack>>(new Map());
  const pendingInvitesRef = useRef<Set<string>>(new Set());
  const activeAudioRef = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setViewerCount(0);
      setParticipants([]);
      return;
    }
    const next = Array.from(room.remoteParticipants.values())
      .map((participant) => participantSummary(participant, pendingInvitesRef.current, activeAudioRef.current));
    setViewerCount(next.length);
    setParticipants(next);
  }, []);

  const rebuildRemoteAudio = useCallback(() => {
    const next = new MediaStream();
    for (const track of remoteAudioTracksRef.current.values()) {
      if (track.readyState !== 'ended') next.addTrack(track);
    }
    setRemoteAudioStream(next);
  }, []);

  const stopPublishing = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    roomNameRef.current = '';
    if (room) await room.disconnect(true).catch(() => undefined);
    remoteAudioTracksRef.current.clear();
    pendingInvitesRef.current.clear();
    activeAudioRef.current.clear();
    setConnected(false);
    setViewerCount(0);
    setParticipants([]);
    setRemoteAudioStream(null);
    setAudioError(null);
  }, []);

  const startPublishing = useCallback(async (roomName: string, stream: MediaStream) => {
    setError(null);
    setAudioError(null);
    const token = await requestToken(roomName, 'publisher');
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;
    roomNameRef.current = roomName;

    const onDisconnected = () => {
      setConnected(false);
      remoteAudioTracksRef.current.clear();
      setRemoteAudioStream(null);
      syncParticipants();
    };
    const onConnected = () => {
      setConnected(true);
      syncParticipants();
    };
    const onParticipantChanged = () => syncParticipants();
    const onTrackPublished = (publication: { kind?: string }, participant: RemoteParticipant) => {
      if (publication.kind === Track.Kind.Audio) activeAudioRef.current.add(participant.identity);
      syncParticipants();
    };
    const onTrackUnpublished = (publication: { kind?: string }, participant: RemoteParticipant) => {
      if (publication.kind === Track.Kind.Audio) activeAudioRef.current.delete(participant.identity);
      syncParticipants();
    };
    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      pendingInvitesRef.current.delete(participant.identity);
      activeAudioRef.current.delete(participant.identity);
      syncParticipants();
    };
    const onTrackSubscribed = (track: RemoteTrack, _publication: unknown, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        const key = `${participant.identity}:${track.sid || `${track.kind}-${Date.now()}`}`;
        remoteAudioTracksRef.current.set(key, track.mediaStreamTrack);
        rebuildRemoteAudio();
      }
      syncParticipants();
    };
    const onTrackUnsubscribed = (track: RemoteTrack, _publication: unknown, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        for (const [key, mediaTrack] of remoteAudioTracksRef.current) {
          if (mediaTrack === track.mediaStreamTrack || key.startsWith(`${participant.identity}:`)) {
            remoteAudioTracksRef.current.delete(key);
          }
        }
        rebuildRemoteAudio();
      }
      syncParticipants();
    };
    const onDataReceived = (payload: LiveKitBytes, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (!participant) return;
      const message = parseAudioMessage(payload, topic);
      if (!message) return;
      if (message.type === 'audio-accepted') {
        pendingInvitesRef.current.delete(participant.identity);
        activeAudioRef.current.add(participant.identity);
        syncParticipants();
      } else if (message.type === 'audio-declined' || message.type === 'audio-ended') {
        pendingInvitesRef.current.delete(participant.identity);
        activeAudioRef.current.delete(participant.identity);
        syncParticipants();
      }
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackUnpublished, onTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.TrackMuted, onParticipantChanged);
    room.on(RoomEvent.TrackUnmuted, onParticipantChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, onParticipantChanged);
    room.on(RoomEvent.DataReceived, onDataReceived);

    try {
      await room.connect(token.url, token.token);
      for (const track of stream.getTracks()) {
        await room.localParticipant.publishTrack(track, {
          source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone,
        });
      }
      if (room.localParticipant.trackPublications.size === 0) {
        await room.localParticipant.enableCameraAndMicrophone();
      }
      setConnected(true);
      syncParticipants();
      return room;
    } catch (err) {
      await room.disconnect(true).catch(() => undefined);
      roomRef.current = null;
      roomNameRef.current = '';
      remoteAudioTracksRef.current.clear();
      pendingInvitesRef.current.clear();
      activeAudioRef.current.clear();
      setConnected(false);
      setParticipants([]);
      setRemoteAudioStream(null);
      const message = err instanceof Error ? err.message : 'No se pudo conectar al room de LiveKit';
      setError(message);
      throw new Error(message);
    }
  }, [rebuildRemoteAudio, syncParticipants]);

  const inviteToSpeak = useCallback(async (viewerIdentity: string) => {
    const room = roomRef.current;
    const roomName = roomNameRef.current;
    if (!room || !roomName) throw new Error('El live todavía no está conectado');
    if (!room.remoteParticipants.has(viewerIdentity) || !viewerIdentity.startsWith('viewer-')) {
      throw new Error('El comprador ya no está conectado');
    }

    setAudioError(null);
    const response = await fetch('/api/livekit/audio-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ roomName, viewerIdentity }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(jsonError(data, 'No se pudo invitar al comprador'));
    if (!data || typeof data !== 'object' || typeof data.inviteToken !== 'string' || typeof data.expiresAt !== 'number') {
      throw new Error('La invitación de audio no es válida');
    }

    try {
      await publishAudioMessage(room, {
        type: 'audio-invite',
        token: data.inviteToken,
        expiresAt: data.expiresAt,
      }, [viewerIdentity]);
      pendingInvitesRef.current.add(viewerIdentity);
      activeAudioRef.current.delete(viewerIdentity);
      syncParticipants();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo enviar la invitación';
      setAudioError(message);
      throw new Error(message);
    }
  }, [syncParticipants]);

  const endAudioConversation = useCallback(async (viewerIdentity: string) => {
    const room = roomRef.current;
    pendingInvitesRef.current.delete(viewerIdentity);
    activeAudioRef.current.delete(viewerIdentity);
    syncParticipants();
    if (!room) return;
    try {
      await publishAudioMessage(room, { type: 'audio-ended', toIdentity: viewerIdentity }, [viewerIdentity]);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'No se pudo finalizar la conversación');
    }
  }, [syncParticipants]);

  useEffect(() => () => {
    void stopPublishing();
  }, [stopPublishing]);

  return {
    connected,
    viewerCount,
    participants,
    remoteAudioStream,
    error,
    audioError,
    startPublishing,
    stopPublishing,
    inviteToSpeak,
    endAudioConversation,
  };
}

export function useLiveKitViewer({ roomName, enabled }: { roomName: string; enabled: boolean }) {
  const roomRef = useRef<Room | null>(null);
  const roomNameRef = useRef(roomName);
  const tracksRef = useRef<Map<string, MediaStreamTrack>>(new Map());
  const pendingInviteRef = useRef<LiveAudioInvite | null>(null);
  const audioPeerRef = useRef<string | null>(null);
  const roomCleanupRef = useRef<(() => void) | null>(null);
  const disposedRef = useRef(false);
  const connectingAudioRef = useRef(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioInvite, setAudioInvite] = useState<LiveAudioInvite | null>(null);
  const [audioSessionActive, setAudioSessionActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [connectingAudio, setConnectingAudio] = useState(false);

  roomNameRef.current = roomName;

  const stopAudioConversation = useCallback(async () => {
    const room = roomRef.current;
    const peerIdentity = audioPeerRef.current;
    if (room && peerIdentity) {
      await publishAudioMessage(room, { type: 'audio-ended', toIdentity: peerIdentity }, [peerIdentity])
        .catch(() => undefined);
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    }
    audioPeerRef.current = null;
    pendingInviteRef.current = null;
    setAudioSessionActive(false);
    setAudioEnabled(false);
    setAudioInvite(null);
  }, []);

  const attachViewerRoom = useCallback((room: Room) => {
    const updateStream = () => {
      const next = new MediaStream();
      for (const track of tracksRef.current.values()) {
        if (track.readyState !== 'ended') next.addTrack(track);
      }
      setRemoteStream(next);
    };
    const onTrackSubscribed = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;
      tracksRef.current.set(track.sid || `${track.kind}-${Date.now()}`, track.mediaStreamTrack);
      updateStream();
    };
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      if (track.sid) tracksRef.current.delete(track.sid);
      else {
        for (const [sid, mediaTrack] of tracksRef.current) {
          if (mediaTrack === track.mediaStreamTrack) tracksRef.current.delete(sid);
        }
      }
      updateStream();
    };
    const onConnected = () => {
      setConnected(true);
      void room.startAudio();
    };
    const onDisconnected = () => {
      setConnected(false);
      if (!connectingAudioRef.current) {
        pendingInviteRef.current = null;
        audioPeerRef.current = null;
        setAudioSessionActive(false);
        setAudioEnabled(false);
        setAudioInvite(null);
      }
    };
    const onDataReceived = (payload: LiveKitBytes, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (!participant) return;
      const message = parseAudioMessage(payload, topic);
      if (!message) return;
      if (message.type === 'audio-invite') {
        if (message.expiresAt <= Date.now()) return;
        const invite: LiveAudioInvite = {
          token: message.token,
          fromIdentity: participant.identity,
          fromName: participant.name,
          expiresAt: message.expiresAt,
        };
        pendingInviteRef.current = invite;
        setAudioInvite(invite);
        setAudioError(null);
      } else if (message.type === 'audio-ended' && audioPeerRef.current === participant.identity) {
        void stopAudioConversation();
      } else if (message.type === 'audio-ended' && pendingInviteRef.current?.fromIdentity === participant.identity) {
        pendingInviteRef.current = null;
        setAudioInvite(null);
      }
    };

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.DataReceived, onDataReceived);

    const cleanup = () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.DataReceived, onDataReceived);
      if (roomCleanupRef.current === cleanup) roomCleanupRef.current = null;
    };
    roomCleanupRef.current = cleanup;
    return cleanup;
  }, [stopAudioConversation]);

  const acceptAudioInvite = useCallback(async () => {
    const invite = pendingInviteRef.current;
    const previousRoom = roomRef.current;
    const currentRoomName = roomNameRef.current;
    if (!invite || !previousRoom || !currentRoomName) return;
    if (invite.expiresAt <= Date.now()) {
      pendingInviteRef.current = null;
      setAudioInvite(null);
      setAudioError('La invitación expiró. Pide una nueva al vendedor.');
      return;
    }
    if (connectingAudioRef.current) return;

    connectingAudioRef.current = true;
    setConnectingAudio(true);
    setAudioError(null);
    let speakerRoom: Room | null = null;
    let detachSpeakerRoom: (() => void) | null = null;
    try {
      roomCleanupRef.current?.();
      roomCleanupRef.current = null;
      await previousRoom.disconnect(true);
      tracksRef.current.clear();
      setRemoteStream(null);

      const token = await withTimeout(
        requestToken(currentRoomName, 'speaker', invite.token),
        15_000,
        'La invitación no pudo validarse a tiempo',
      );
      if (disposedRef.current) return;

      speakerRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = speakerRoom;
      detachSpeakerRoom = attachViewerRoom(speakerRoom);
      await withTimeout(
        speakerRoom.connect(token.url, token.token),
        20_000,
        'No se pudo conectar al audio del live',
      );
      const publication = await withTimeout(
        speakerRoom.localParticipant.setMicrophoneEnabled(true),
        15_000,
        'El navegador no habilitó el micrófono a tiempo',
      );
      if (!publication) throw new Error('El navegador no habilitó el micrófono');
      audioPeerRef.current = invite.fromIdentity;
      pendingInviteRef.current = null;
      setAudioInvite(null);
      setAudioSessionActive(true);
      setAudioEnabled(true);
      await publishAudioMessage(speakerRoom, { type: 'audio-accepted', toIdentity: invite.fromIdentity }, [invite.fromIdentity])
        .catch(() => undefined);
    } catch (err) {
      if (speakerRoom) {
        detachSpeakerRoom?.();
        if (roomRef.current === speakerRoom) {
          roomRef.current = null;
          roomCleanupRef.current = null;
        }
        await speakerRoom.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
        await speakerRoom.disconnect(true).catch(() => undefined);
      }
      setAudioError(err instanceof Error ? err.message : 'No se pudo iniciar la conversación de audio');
    } finally {
      connectingAudioRef.current = false;
      setConnectingAudio(false);
    }
  }, [attachViewerRoom]);

  const declineAudioInvite = useCallback(async () => {
    const invite = pendingInviteRef.current;
    const room = roomRef.current;
    pendingInviteRef.current = null;
    setAudioInvite(null);
    if (room && invite) {
      await publishAudioMessage(room, { type: 'audio-declined', toIdentity: invite.fromIdentity }, [invite.fromIdentity])
        .catch(() => undefined);
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room || !audioPeerRef.current) return;
    const next = !audioEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setAudioEnabled(next);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'No se pudo cambiar el micrófono');
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!enabled || !roomName || typeof window === 'undefined') return;
    let disposed = false;
    disposedRef.current = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const detachRoom = attachViewerRoom(room);

    void (async () => {
      try {
        const token = await requestToken(roomName, 'viewer');
        if (disposed) return;
        await room.connect(token.url, token.token);
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'No se pudo conectar a LiveKit');
      }
    })();

    return () => {
      disposed = true;
      disposedRef.current = true;
      detachRoom();
      roomCleanupRef.current?.();
      const activeRoom = roomRef.current;
      if (activeRoom) {
        void activeRoom.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
        void activeRoom.disconnect(true).catch(() => undefined);
      }
      roomRef.current = null;
      tracksRef.current.clear();
      pendingInviteRef.current = null;
      audioPeerRef.current = null;
      setRemoteStream(null);
      setConnected(false);
      setAudioSessionActive(false);
      setAudioInvite(null);
      setAudioEnabled(false);
    };
  }, [attachViewerRoom, enabled, roomName]);

  return {
    remoteStream,
    connected,
    error,
    audioError,
    audioInvite,
    audioSessionActive,
    audioEnabled,
    connectingAudio,
    acceptAudioInvite,
    declineAudioInvite,
    toggleMicrophone,
    stopAudioConversation,
  };
}
