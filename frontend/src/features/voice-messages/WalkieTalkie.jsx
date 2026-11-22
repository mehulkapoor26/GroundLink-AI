/**
 * WalkieTalkie — push-to-talk button component.
 *
 * Records audio via the MediaRecorder API while the user holds the button,
 * uploads the blob via HTTP to /api/voice/upload, and broadcasts the
 * resulting voice message over Socket.IO.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '../../services/socket.js';
import './voice.css';

const MAX_DURATION = 30; // seconds

export default function WalkieTalkie({ group, connection }) {
  const [state, setState] = useState('idle'); // idle | recording | uploading
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const isCancelled = useRef(false);
  const sentRef = useRef(false);

  // ── Cleanup helper ──────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (stream.current) {
      stream.current.getTracks().forEach(t => t.stop());
      stream.current = null;
    }
    mediaRecorder.current = null;
    chunks.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // ── Start recording ─────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (state !== 'idle') return;
    setError('');
    isCancelled.current = false;
    sentRef.current = false;

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Your browser does not support audio recording.');
      return;
    }

    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setError('Microphone permission denied. Please allow mic access and try again.');
      } else {
        setError(`Microphone error: ${e.message}`);
      }
      return;
    }

    // Pick codec — prefer opus/webm, fall back to whatever's available
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
      cleanup();
      return;
    }

    mediaRecorder.current.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
    mediaRecorder.current.onstop = () => {
      if (isCancelled.current || sentRef.current) { cleanup(); return; }
      sentRef.current = true;
      const blob = new Blob(chunks.current, { type: mediaRecorder.current?.mimeType || 'audio/webm' });
      const duration = (Date.now() - startTimeRef.current) / 1000;
      uploadAudio(blob, duration);
      cleanup();
    };

    mediaRecorder.current.start(250); // collect chunks every 250ms
    startTimeRef.current = Date.now();
    setState('recording');
    setElapsed(0);

    // Emit speaking indicator
    socket.emit('voice:speaking', { speaking: true });

    // Timer for elapsed display + 30s hard stop
    timerRef.current = setInterval(() => {
      const secs = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_DURATION) stopRecording();
    }, 200);
  }, [state, cleanup]);

  // ── Stop recording ──────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (state !== 'recording' || !mediaRecorder.current) return;
    socket.emit('voice:speaking', { speaking: false });
    if (mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop(); // triggers onstop → upload
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setState('idle');
  }, [state]);

  // ── Cancel recording ────────────────────────────────────────────
  const cancelRecording = useCallback(() => {
    isCancelled.current = true;
    socket.emit('voice:speaking', { speaking: false });
    if (mediaRecorder.current?.state === 'recording') mediaRecorder.current.stop();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    cleanup();
    setState('idle');
    setElapsed(0);
  }, [cleanup]);

  // ── Upload audio blob via HTTP ──────────────────────────────────
  const uploadAudio = useCallback(async (blob, duration) => {
    setState('uploading');
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
      // Broadcast voice message metadata to the group via socket
      socket.emit('voice:broadcast', message);
    } catch (e) {
      setError(e.message || 'Failed to send voice message');
    } finally {
      setState('idle');
      setElapsed(0);
    }
  }, [group]);

  // ── Pointer / touch handlers ────────────────────────────────────
  const onPointerDown = useCallback(e => {
    e.preventDefault();
    e.target.setPointerCapture?.(e.pointerId);
    startRecording();
  }, [startRecording]);

  const onPointerUp = useCallback(e => {
    e.preventDefault();
    stopRecording();
  }, [stopRecording]);

  // ── Format timer ────────────────────────────────────────────────
  const fmt = s => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const remaining = Math.max(0, MAX_DURATION - elapsed);

  const isRecording = state === 'recording';
  const isUploading = state === 'uploading';
  const disabled = !connection || isUploading;

  return (
    <>
      <div className="walkie-bar">
        <div className="ptt-wrap">
          <button
            className={`ptt-btn ${isRecording ? 'is-recording' : ''} ${isUploading ? 'is-uploading' : ''}`}
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
            {isRecording ? (
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
          {isRecording && (
            <button className="ptt-cancel" onClick={cancelRecording} type="button">✕ Cancel</button>
          )}
        </div>
      </div>
      {error && <div className="ptt-error">{error}</div>}
    </>
  );
}
