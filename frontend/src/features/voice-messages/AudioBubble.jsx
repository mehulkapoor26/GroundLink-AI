/**
 * AudioBubble — renders a single voice message in the chat timeline.
 *
 * Features:
 *  • Play / pause with global one-at-a-time enforcement
 *  • Seekable progress bar
 *  • Duration display
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './voice.css';

// Global: only one audio element playing at a time.
let activeAudio = null;
let activeSetPlaying = null;

function stopGlobalAudio() {
  if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; }
  if (activeSetPlaying) activeSetPlaying(false);
  activeAudio = null;
  activeSetPlaying = null;
}

export default function AudioBubble({ message }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(message.duration || 0);
  const audioRef = useRef(null);
  const statusLabel = message.status === 'synced'
    ? 'Synced'
    : message.status === 'syncing' && globalThis.navigator?.onLine !== false
      ? 'Syncing…'
      : 'Pending Sync';

  const localAudioUrl = useMemo(
    () => message.audioBlob ? URL.createObjectURL(message.audioBlob) : null,
    [message.audioBlob, message.id]
  );
  const audioUrl = localAudioUrl || `/api/voice/${message.audioId}`;

  // Create audio element lazily
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio(audioUrl);
      a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => {
        if (isFinite(a.duration)) setAudioDuration(a.duration);
      });
      a.addEventListener('timeupdate', () => {
        setCurrentTime(a.currentTime);
        const dur = a.duration || message.duration || 1;
        setProgress(dur > 0 ? (a.currentTime / dur) * 100 : 0);
      });
      a.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        if (activeAudio === a) { activeAudio = null; activeSetPlaying = null; }
      });
      a.addEventListener('error', () => { setLoading(false); setPlaying(false); });
      audioRef.current = a;
    }
    return audioRef.current;
  }, [audioUrl, message.duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        if (activeAudio === audioRef.current) { activeAudio = null; activeSetPlaying = null; }
      }
      if (localAudioUrl) URL.revokeObjectURL(localAudioUrl);
    };
  }, [localAudioUrl]);

  // ── Play / Pause ────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const audio = getAudio();
    if (playing) {
      audio.pause();
      setPlaying(false);
      if (activeAudio === audio) { activeAudio = null; activeSetPlaying = null; }
    } else {
      // Stop any other playing audio
      if (activeAudio && activeAudio !== audio) stopGlobalAudio();
      setLoading(true);
      try {
        await audio.play();
        activeAudio = audio;
        activeSetPlaying = setPlaying;
        setPlaying(true);
      } catch {
        // Autoplay may be blocked
      }
      setLoading(false);
    }
  }, [playing, getAudio]);

  // ── Seek ────────────────────────────────────────────────────────
  const onSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const audio = getAudio();
    const dur = audio.duration || message.duration || 1;
    audio.currentTime = pct * dur;
    setProgress(pct * 100);
    setCurrentTime(pct * dur);
  }, [getAudio, message.duration]);

  // ── Format time ─────────────────────────────────────────────────
  const fmt = s => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-bubble">
      <div className="voice-player">
        <button
          className={`voice-play-btn ${loading ? 'is-loading' : ''}`}
          onClick={togglePlay}
          disabled={loading}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="voice-track">
          <div className="voice-progress" onClick={onSeek}>
            <div className="voice-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="voice-duration">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(audioDuration)}</span>
          </div>
        </div>
      </div>

      {message.status && (
        <div className="voice-save-status" role="status">
          {statusLabel}
        </div>
      )}

    </div>
  );
}

// Export for Radio Mode
export { stopGlobalAudio };
