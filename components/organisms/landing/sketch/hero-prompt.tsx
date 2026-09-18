"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SUGGESTIONS = [
  {
    tag: "⚡ Launch",
    text: "LinkedIn teaser for our v2 launch: what's new for our customers, why it matters, and where to try it.",
  },
  {
    tag: "🎯 Explainer",
    text: "Show prospects how onboarding works in 3 steps: signup in 30s, upload your data, and get results without jargon.",
  },
  {
    tag: "🚀 Product",
    text: "Introduce our automated billing in 90 seconds: the problem with manual invoices, one-click export, and what it saves.",
  },
];

export function HeroPrompt() {
  const [text, setText] = useState("");
  const [typed, setTyped] = useState("");
  const [touched, setTouched] = useState(false);
  const [ratio, setRatio] = useState("16:9");

  useEffect(() => {
    if (touched) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let brief = 0;
    let i = reduced ? SUGGESTIONS[0].text.length : 0;
    let timer: number;
    const step = () => {
      if (reduced) {
        setTyped(SUGGESTIONS[0].text);
        return;
      }
      const full = SUGGESTIONS[brief].text;
      if (i <= full.length) {
        setTyped(full.slice(0, i));
        i += 1;
        timer = window.setTimeout(step, 28);
      } else {
        timer = window.setTimeout(() => {
          brief = (brief + 1) % SUGGESTIONS.length;
          i = 0;
          step();
        }, 2400);
      }
    };
    timer = window.setTimeout(step, 0);
    return () => window.clearTimeout(timer);
  }, [touched]);

  const activePrompt = touched && text.trim() ? text.trim() : typed;

  const handleGenerateClick = () => {
    if (typeof window !== "undefined" && activePrompt) {
      try {
        sessionStorage.setItem("draft_prompt", activePrompt);
      } catch {
        // Ignorer les erreurs d'accès au storage en navigation privée stricte
      }
    }
  };

  const selectSuggestion = (suggestionText: string) => {
    setTouched(true);
    setText(suggestionText);
  };

  return (
    <div className="prompt-wrapper">
      <div className="prompt-suggestions">
        <span className="prompt-suggestions-label">Try:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.tag}
            type="button"
            className="prompt-suggestion-chip"
            onClick={() => selectSuggestion(s.text)}
          >
            {s.tag}
          </button>
        ))}
      </div>

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
          <div className="prompt-pills">
            {["16:9", "9:16", "1:1"].map((r) => (
              <button
                key={r}
                type="button"
                className={`prompt-pill-btn ${ratio === r ? "is-active" : ""}`}
                onClick={() => setRatio(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <Link
            href={`/signup?prompt=${encodeURIComponent(activePrompt)}`}
            onClick={handleGenerateClick}
            className="sk-btn sk-btn-main prompt-go"
          >
            Create video →
          </Link>
        </div>
      </div>

      <div className="hero-reassurance" aria-label="Product guarantees">
        <span className="reassurance-item">✓ Free plan available</span>
        <span className="reassurance-dot">·</span>
        <span className="reassurance-item">✓ No credit card required</span>
        <span className="reassurance-dot">·</span>
        <span className="reassurance-item">✓ Ready in 60 seconds</span>
      </div>
    </div>
  );
}
