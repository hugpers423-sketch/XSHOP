import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { issueAudioInvite, verifyAudioInvite } from './livekit-invites';

describe('LiveKit audio invitations', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-for-livekit-invites';
    delete process.env.LIVEKIT_AUDIO_INVITE_SECRET;
  });

  it('issues and verifies an invitation for the same room', async () => {
    const issued = await issueAudioInvite({
      roomName: 'xshop-room-1',
      sellerId: 'seller-1',
      sellerIdentity: 'seller-seller-1',
      viewerIdentity: 'viewer-1',
    });

    await expect(verifyAudioInvite(issued.inviteToken, 'xshop-room-1')).resolves.toMatchObject({
      type: 'audio-invite',
      roomName: 'xshop-room-1',
      sellerId: 'seller-1',
      sellerIdentity: 'seller-seller-1',
      viewerIdentity: 'viewer-1',
    });
    expect(issued.expiresAt).toBeGreaterThan(Date.now());
  });

  it('rejects an invitation reused with another room or tampered token', async () => {
    const issued = await issueAudioInvite({
      roomName: 'xshop-room-1',
      sellerId: 'seller-1',
      sellerIdentity: 'seller-seller-1',
      viewerIdentity: 'viewer-1',
    });

    await expect(verifyAudioInvite(issued.inviteToken, 'xshop-room-2')).resolves.toBeNull();
    await expect(verifyAudioInvite(`${issued.inviteToken}tampered`, 'xshop-room-1')).resolves.toBeNull();
  });
});
