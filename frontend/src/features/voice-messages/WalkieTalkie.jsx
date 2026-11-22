/**
 * WalkieTalkie — push-to-talk button component.
 *
 * Records audio via the MediaRecorder API while the user holds the button,
 * uploads the blob via HTTP to /api/voice/upload, and broadcasts the
 * resulting voice message over Socket.IO.
 *
 * JIT (Just-in-Time) behaviour
 * ─────────────────────────────
 * • The microphone is requested ONLY at the moment the user presses the
 *   button — never before.
 * • If a previous stream is still alive (all tracks "live") it is reused
 *   immediately, so a second press is instant.
 * • If the user releases the button while getUserMedia is still in-flight
 *   an abort flag causes the freshly-opened stream to be torn down and no
 *   recording is started.
 * • On release / cancel / unmount every track is stopped and all state is
 *   reset, releasing the browser's recording lock immediately.
 * • The 30-second hard-stop uses a ref-based guard so it is never caught
 *   by a stale closure of stopRecording.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket.js';
import './voice.css';

const MAX_DURATION = 30; // seconds

export default function WalkieTalkie({ group, connection, onSend }) {
  const [state, setState] = useState('idle'); // idle | acquiring | recording | uploading
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const isCancelled = useRef(false);
  const sentRef = useRef(false);
  // JIT: abort flag for in-flight getUserMedia calls.
  const abortAcquire = useRef(false);
  // Stable ref to the current state so the interval hard-stop never reads a stale closure.
  const stateRef = useRef('idle');

  const setStateSync = (s) => { stateRef.current = s; setState(s); };

  // ── Release all mic tracks and reset recorder state ─────────────
  const releaseMic = useCallback(() => {
    if (stream.current) {
      // Only stop tracks that are still live — avoids double-stop errors.
      stream.current.getTracks().forEach(t => { if (t.readyState !== 'ended') t.stop(); });
      stream.current = null;
    }
    mediaRecorder.current = null;
    chunks.current = [];
  }, []);

  // ── Full cleanup: timer + mic + recorder ────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    releaseMic();
  }, [releaseMic]);

  // Cleanup on unmount — release any lingering mic stream immediately.
  useEffect(() => cleanup, [cleanup]);

  // ── Upload audio blob via HTTP ──────────────────────────────────
  // Defined before startRecording so it can be referenced in onstop.
  const uploadAudio = useCallback(async (blob, duration) => {
    setStateSync('uploading');
    const userName = sessionStorage.getItem('groundlink-name') || 'Guest';
    try {
      const res = await fetch('/api/voice/upload', {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
          'X-GroundLink-User': userName,
          'X-GroundLink-Group': group.code,
          'X-GroundLink-Duration': String(Math.round(duration * 10) / 10),
        },
        body: blob,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed (${res.status})`);
      }
      const message = await res.json();
      // Optimistically append to sender's own UI immediately (before socket echo).
      // MessagePanel deduplicates by id, so the echo from io.to() won't double-add.
      onSend?.(message);
      // Broadcast voice message metadata to the group via socket.
      socket.emit('voice:broadcast', message);
    } catch (e) {
      setError(e.message || 'Failed to send voice message');
    } finally {
      setStateSync('idle');
      setElapsed(0);
    }
  }, [group, onSend]);

  // ── Start recording (JIT mic acquisition) ───────────────────────
  const startRecording = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
    setError('');
    isCancelled.current = false;
    sentRef.current = false;
    abortAcquire.current = false;

    // Check browser support before touching state.
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser does not support audio recording.');
      return;
    }

    // JIT: reuse an already-open stream if all its tracks are still live.
    // This makes a second press after a quick cancel feel instant.
    const reuseStream =
      stream.current &&
      stream.current.getTracks().every(t => t.readyState === 'live');

    if (!reuseStream) {
      // JIT: signal acquiring state so UI can reflect the brief permission prompt.
      setStateSync('acquiring');
      try {
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
        // JIT abort: if the user released before getUserMedia resolved, discard immediately.
        if (abortAcquire.current) {
          acquired.getTracks().forEach(t => t.stop());
          setStateSync('idle');
          return;
        }
        // Discard any stale stream before assigning the new one.
        releaseMic();
        stream.current = acquired;
      } catch (e) {
        setStateSync('idle');
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow mic access and try again.');
        } else {
          setError(`Microphone error: ${e.message}`);
        }
        return;
      }
    }

    // Pick codec — prefer opus/webm, fall back to whatever's available.
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';

    chunks.current = [];
    const options = mimeType ? { mimeType } : {};
    try {
      mediaRecorder.current = new MediaRecorder(stream.current, options);
    } catch {
      setError('Failed to initialise audio recorder.');
      releaseMic();
      setStateSync('idle');
      return;
    }

    // Capture mimeType and uploadAudio in the onstop closure now, before cleanup
    // could null mediaRecorder.current.
    const capturedMime = mediaRecorder.current.mimeType || 'audio/webm';

    mediaRecorder.current.ondataavailable = e => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    mediaRecorder.current.onstop = () => {
      if (isCancelled.current || sentRef.current) {
        // JIT: release mic immediately on cancel/duplicate-stop.
        releaseMic();
        return;
      }
      sentRef.current = true;
      const blob = new Blob(chunks.current, { type: capturedMime });
      const duration = (Date.now() - startTimeRef.current) / 1000;
      // Release mic tracks right away — don't wait for the HTTP upload.
      releaseMic();
      uploadAudio(blob, duration);
    };

    mediaRecorder.current.start(250); // collect chunks every 250 ms
    startTimeRef.current = Date.now();
    setStateSync('recording');
    setElapsed(0);

    // Emit live speaking indicator to the group.
    socket.emit('voice:speaking', { speaking: true });

    // Timer: update elapsed display + enforce 30-second hard stop.
    // Uses stateRef (not the closure value of state) to avoid stale-closure bugs.
    timerRef.current = setInterval(() => {
      const secs = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_DURATION && stateRef.current === 'recording') {
        // Hard stop: clear timer and trigger stop inline to avoid stale stopRecording ref.
        clearInterval(timerRef.current);
        timerRef.current = null;
        socket.emit('voice:speaking', { speaking: false });
        if (mediaRecorder.current?.state === 'recording') {
          mediaRecorder.current.stop(); // triggers onstop → upload
        }
        setStateSync('idle');
      }
    }, 200);
  }, [releaseMic, uploadAudio]);

  // ── Stop recording ──────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (stateRef.current !== 'recording' || !mediaRecorder.current) return;
    socket.emit('voice:speaking', { speaking: false });
    if (mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop(); // triggers onstop → upload
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // Note: stateRef / setState('idle') happens after onstop fires via uploadAudio's finally.
    // Set to idle here so the button unlocks visually without waiting for HTTP.
    setStateSync('idle');
  }, []);

  // ── Cancel recording ────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    // JIT abort: if still waiting for getUserMedia, signal abort.
    abortAcquire.current = true;
    isCancelled.current = true;
    socket.emit('voice:speaking', { speaking: false });
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // JIT: release mic tracks immediately — don't wait for onstop.
    releaseMic();
    setStateSync('idle');
    setElapsed(0);
  }, [releaseMic]);

  // ── Pointer / touch handlers ────────────────────────────────────
  const onPointerDown = useCallback(e => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    startRecording();
  }, [startRecording]);

  const onPointerUp = useCallback(e => {
    e.preventDefault();
    // JIT abort: if getUserMedia is still in-flight, cancel instead of stop.
    if (stateRef.current === 'acquiring') {
      abortAcquire.current = true;
      setStateSync('idle');
      return;
    }
    stopRecording();
  }, [stopRecording]);

  // ── Format timer ────────────────────────────────────────────────
  const fmt = s => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const remaining = Math.max(0, MAX_DURATION - elapsed);

  const isAcquiring = state === 'acquiring';
  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const disabled = !connection || isUploading;

  return (
    <>
      <div className="walkie-bar">
        <div className="ptt-wrap">
          <button
            className={`ptt-btn ${isRecording || isAcquiring ? 'is-recording' : ''} ${isUploading ? 'is-uploading' : ''}`}
            disabled={disabled}
            onPointerDown={disabled ? undefined : onPointerDown}
            onPointerUp={disabled ? undefined : onPointerUp}
            onPointerCancel={disabled ? undefined : onPointerUp}
            onContextMenu={e => e.preventDefault()}
            aria-label={isRecording ? 'Release to send voice message' : 'Hold to record voice message'}
            title={isRecording ? 'Release to send' : 'Hold to talk'}
          >
            {isUploading ? '↑' : '🎙'}
          </button>
          <div className="ptt-info">
            {isAcquiring ? (
              <div className="ptt-status">Preparing microphone…</div>
            ) : isRecording ? (
              <>
                <div className="ptt-status is-recording">● RECORDING</div>
                <div className="ptt-timer">{fmt(elapsed)}</div>
                {remaining <= 10 && <div className="ptt-countdown">{Math.ceil(remaining)}s remaining</div>}
              </>
            ) : isUploading ? (
              <div className="ptt-status">Sending voice message…</div>
            ) : (
              <div className="ptt-status">
                {connection ? 'Hold to talk' : 'Waiting for connection…'}
              </div>
            )}
          </div>
          {(isRecording || isAcquiring) && (
            <button className="ptt-cancel" onClick={cancelRecording} type="button">✕ Cancel</button>
          )}
        </div>
      </div>
      {error && <div className="ptt-error">{error}</div>}
    </>
  );
}
