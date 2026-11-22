/**
 * Voice-specific Socket.IO events.
 *
 * These run alongside the existing text-message socket handlers
 * in sockets/index.js and share the same io / socket instances.
 */

const room = code => `group:${code}`;

export function configureVoiceSockets(io) {
  io.on('connection', socket => {
    // ── Live speaking indicator ────────────────────────────────────
    socket.on('voice:speaking', ({ speaking } = {}) => {
      const code = socket.data.groupCode;
      if (!code) return;
      io.to(room(code)).emit('voice:speaking', {
        socketId: socket.id,
        name: socket.data.memberName || 'Someone',
        speaking: !!speaking,
      });
    });

    // ── Broadcast a new voice message to the group ────────────────
    // Called by the frontend AFTER the HTTP upload succeeds, so we
    // just relay the metadata (no binary on the socket).
    socket.on('voice:broadcast', (message, acknowledge = () => {}) => {
      const code = socket.data.groupCode;
      if (!code || !message) return acknowledge({ ok: false, error: 'Join a group before broadcasting a voice message' });
      // Ensure the message is tagged for the correct group
      if (message.groupCode !== code) return acknowledge({ ok: false, error: 'Voice message group does not match' });
      // Use io.to (not socket.to) so the sender's own tab also receives
      // the message:new event and the voice note appears immediately.
      io.to(room(code)).emit('message:new', message);
      acknowledge({ ok: true });
    });

    // ── Clean up speaking indicator on disconnect ─────────────────
    // The existing disconnect handler in sockets/index.js handles
    // presence.  We only need to clear the speaking state.
    socket.on('disconnect', () => {
      const code = socket.data.groupCode;
      if (code) {
        io.to(room(code)).emit('voice:speaking', {
          socketId: socket.id,
          name: socket.data.memberName || 'Someone',
          speaking: false,
        });
      }
    });
  });
}
