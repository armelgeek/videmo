"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const BRIEFS = [
  "Introduce our new billing in 90 seconds: the problem, one-click export, and what it changes for the finance team.",
  "Show prospects how onboarding works in 3 steps, without the jargon.",
  "LinkedIn teaser for our v2 launch: what's new for our customers.",
];

export function HeroPrompt() {
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let brief = 0;
    let i = reduced ? BRIEFS[0].length : 0;
    let timer: number;
    const step = () => {
      if (reduced) {
        setTyped(BRIEFS[0]);
        return;
      }
      const full = BRIEFS[brief];
      if (i <= full.length) {
        setTyped(full.slice(0, i));
        i += 1;
        timer = window.setTimeout(step, 32);
      } else {
        timer = window.setTimeout(() => {
          brief = (brief + 1) % BRIEFS.length;
          i = 0;
          step();
        }, 2200);
      }
    };
    timer = window.setTimeout(step, 0);
    return () => window.clearTimeout(timer);
  }, [touched]);

  return (
    <div className="prompt">
      <label htmlFor="hero-brief" className="sr-only">Describe your video</label>
      <textarea
        id="hero-brief"
        rows={4}
        value={touched ? text : typed}
        onFocus={() => {
          if (!touched) {
            setTouched(true);
            setText("");
          }
        }}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe your video: the message, the key points, the audience…"
      />
      <div className="prompt-bar">
        <span className="prompt-pills" aria-hidden="true">
          <span>16:9</span>
          <span>1-2 min</span>
          <span>English</span>
        </span>
        <Link href="/signup" className="sk-btn sk-btn-main prompt-go">Generate my video →</Link>
      </div>
    </div>
  );
}
