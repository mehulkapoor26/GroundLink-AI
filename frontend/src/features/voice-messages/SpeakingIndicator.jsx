/**
 * SpeakingIndicator — shows "[User] is speaking..." in the chat panel.
 */
import './voice.css';

export default function SpeakingIndicator({ speakers }) {
  const names = speakers.filter(s => s.speaking).map(s => s.name);
  if (names.length === 0) return null;

  const label = names.length === 1
    ? `${names[0]} is speaking…`
    : names.length === 2
      ? `${names[0]} and ${names[1]} are speaking…`
      : `${names[0]} and ${names.length - 1} others are speaking…`;

  return (
    <div className="speaking-bar">
      <span className="pulse-dot" />
      {label}
    </div>
  );
}
