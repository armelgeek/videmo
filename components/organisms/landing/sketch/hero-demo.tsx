"use client";

import { useRef, useState } from "react";
import { EngineScene } from "./engine-scene";
import { ANIMATION_STYLES } from "./animation-styles";

type AspectRatio = "16:9" | "9:16" | "1:1";

const WAVE_BARS = [
  6, 12, 18, 9, 22, 14, 26, 17, 10, 20, 28, 13, 7, 18, 24, 11, 6, 15, 21, 9,
  16, 8, 19, 12, 7, 17, 25, 13, 9, 5,
];

export function HeroDemo() {
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    } else {
      audio.pause();
      setIsPlayingAudio(false);
    }
  };

  const onAudioEnded = () => {
    setIsPlayingAudio(false);
  };

  return (
    <div className="hero-demo">
      <div className="hero-tabs" role="tablist" aria-label="Video aspect ratio">
        <span className="sk-eyebrow">Ratio:</span>
        <button
          type="button"
          role="tab"
          aria-selected={ratio === "16:9"}
          className={`hero-tab ${ratio === "16:9" ? "is-on" : ""}`}
          onClick={() => setRatio("16:9")}
        >
          <i style={{ width: 18, height: 10 }} aria-hidden="true" />
          16:9
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ratio === "9:16"}
          className={`hero-tab ${ratio === "9:16" ? "is-on" : ""}`}
          onClick={() => setRatio("9:16")}
        >
          <i style={{ width: 8, height: 14 }} aria-hidden="true" />
          9:16 Shorts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={ratio === "1:1"}
          className={`hero-tab ${ratio === "1:1" ? "is-on" : ""}`}
          onClick={() => setRatio("1:1")}
        >
          <i style={{ width: 12, height: 12 }} aria-hidden="true" />
          1:1 Square
        </button>
      </div>

      <div className={`hero-board is-${ratio.replace(":", "-")}`}>
        <EngineScene aspectRatio={ratio} />
        <span className="hero-sticky is-top" aria-hidden="true">
          voiceover synced word by word ✓
        </span>
        <span className="hero-sticky is-bottom" aria-hidden="true">
          {ANIMATION_STYLES.length} hand styles ✍
        </span>
      </div>

      <div
        className={`hero-voice ${isPlayingAudio ? "is-playing" : ""}`}
        onClick={toggleAudio}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleAudio();
          }
        }}
        aria-label={isPlayingAudio ? "Pause synthetic voice sample" : "Play synthetic voice sample"}
      >
        <audio
          ref={audioRef}
          src="/audio/test-audio-8s.mp3"
          onEnded={onAudioEnded}
          preload="none"
        />
        <span className="hero-play" aria-hidden="true">
          {isPlayingAudio ? "❚❚" : "▶"}
        </span>
        <span className={`hero-wave ${isPlayingAudio ? "is-animating" : ""}`} aria-hidden="true">
          {WAVE_BARS.map((h, i) => (
            <i
              key={i}
              style={{
                height: isPlayingAudio ? `${Math.max(6, (h * 1.15) % 28)}px` : `${h}px`,
                opacity: isPlayingAudio ? 1 : i < 16 ? 1 : 0.35,
                animationDelay: `${(i % 6) * 0.12}s`,
              }}
            />
          ))}
        </span>
        <span className="sk-mono hero-voice-meta">
          {isPlayingAudio ? "Playing sample..." : "Nova · English · Click to listen"}
        </span>
      </div>

      <p className="sk-note hero-video-note">drawn live by our engine ↑</p>
    </div>
  );
}
