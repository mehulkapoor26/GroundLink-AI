/**
 * RadioMode — optional auto-play of received voice messages.
 *
 * Queues incoming voice messages (not from the current user) and plays
 * them one at a time in order of receipt.  Respects browser autoplay
 * restrictions by requiring user activation first (the enable toggle).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { stopGlobalAudio } from './AudioBubble.jsx';
import './voice.css';

export default function RadioMode({ messages, currentUser }) {
  const [enabled, setEnabled] = useState(false);
  const queueRef = useRef([]);
  const playingRef = useRef(false);
  const lastPlayedRef = useRef(new Set());

  const playNext = useCallback(() => {
    if (!enabled || queueRef.current.length === 0) {
      playingRef.current = false;
      return;
    }
    playingRef.current = true;
    const msg = queueRef.current.shift();
    if (!msg || lastPlayedRef.current.has(msg.id)) {
      playNext();
      return;
    }
    lastPlayedRef.current.add(msg.id);

    stopGlobalAudio();
    const audio = new Audio(`/api/voice/${msg.audioId}`);
    audio.addEventListener('ended', () => playNext());
    audio.addEventListener('error', () => playNext());
    audio.play().catch(() => playNext());
  }, [enabled]);

  // Watch for new voice messages
  useEffect(() => {
    if (!enabled) return;
    const voiceMessages = messages.filter(m => m.type === 'voice' && m.sender !== currentUser);
    const newMessages = voiceMessages.filter(m => !lastPlayedRef.current.has(m.id));
    if (newMessages.length > 0) {
      queueRef.current.push(...newMessages);
      if (!playingRef.current) playNext();
    }
  }, [messages, enabled, currentUser, playNext]);

  // Stop on disable
  useEffect(() => {
    if (!enabled) {
      queueRef.current = [];
      playingRef.current = false;
    }
  }, [enabled]);

  return (
    <div className="radio-toggle">
      <label>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
        📻 RADIO MODE — Auto-play incoming voice messages
      </label>
    </div>
  );
}
