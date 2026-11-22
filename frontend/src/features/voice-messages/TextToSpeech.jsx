/**
 * TextToSpeech — inline TTS button for text messages (Gnani Timbre).
 */
import { useCallback, useRef, useState } from 'react';
import { stopGlobalAudio } from './AudioBubble.jsx';
import './voice.css';

export default function TextToSpeech({ text, gnaniAvailable }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('hi-IN');
  const audioRef = useRef(null);

  const speak = useCallback(async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    setError('');
    const userName = sessionStorage.getItem('groundlink-name') || 'Guest';

    try {
      const res = await fetch('/api/gnani/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GroundLink-User': userName,
        },
        body: JSON.stringify({ text, language }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `TTS failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Stop any other playing audio
      stopGlobalAudio();

      if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
      const audio = new Audio(url);
      audio.addEventListener('ended', () => { setPlaying(false); URL.revokeObjectURL(url); });
      audio.addEventListener('error', () => { setPlaying(false); setError('Playback failed'); });
      audioRef.current = audio;
      await audio.play();
      setPlaying(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [text, language, playing]);

  if (!gnaniAvailable) return null;

  return (
    <div className="tts-inline">
      <select className="lang-select" value={language} onChange={e => setLanguage(e.target.value)} disabled={loading} style={{ fontSize: '7px' }}>
        <option value="hi-IN">Hindi</option>
        <option value="en-IN">English</option>
        <option value="pa-IN">Punjabi</option>
      </select>
      <button className="voice-action-btn" onClick={speak} disabled={loading}>
        {loading ? '⟳ Generating…' : playing ? '⏹ Stop' : '🔊 Listen'}
      </button>
      {error && <span style={{ fontSize: '8px', color: '#e6a28a' }}>{error}</span>}
    </div>
  );
}
