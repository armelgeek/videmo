import type React from "react";
import Link from "next/link";
import { HeroPrompt } from "./hero-prompt";
import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import { HowItWorks } from "./how-it-works";
import { HandArrow } from "./hand-arrow";
import { appConfig } from "@/lib/config";
import { EngineScene } from "./engine-scene";
import { SavingsCalculator } from "./savings-calculator";
import { PLANS } from "./pricing";
import "./sketch.css";

export const sketchFaqs = [
  {
    question: "Do I need to know how to animate or draw?",
    answer: `No. You write the text, ${appConfig.name} splits it into scenes, generates the illustrations and draws them by hand. You tweak whatever you want, scene by scene.`,
  },
  {
    question: "Can I use my own voice?",
    answer: "Yes. Upload your recording: it's transcribed word by word and the drawing syncs to it. Or pick a synthetic voice.",
  },
  {
    question: "Can my teammates or clients work on it?",
    answer: "Invite them by email to your workspace with the right role. When someone edits a project, everyone else sees it and can't overwrite their work.",
  },
  {
    question: "Which formats can I export?",
    answer: "16:9 for YouTube and your website, 9:16 for Reels, TikTok and Shorts, 1:1 for LinkedIn and Instagram feeds.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. There's no commitment, and you can cancel from your billing page.",
  },
];


const doodle = (d: string) => (
  <svg viewBox="0 0 48 48" width="48" height="48">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PAINS = [
  {
    big: "2–3 wks",
    text: "typical turnaround from brief to final cut with an agency or freelancer.",
    scribble: "still waiting on v3…",
    doodle: doodle("M8 12 h32 v28 h-32 z M8 20 h32 M16 7 v9 M32 7 v9 M15 28 l5 5 M20 28 l-5 5 M28 28 l5 5 M33 28 l-5 5"),
  },
  {
    big: "3 tools",
    text: "at least: one for the script, one for animation, one for voice and editing.",
    scribble: "too many tabs",
    doodle: doodle("M6 14 h18 v22 h-18 z M15 10 h18 v22 M24 6 h18 v22 h-9"),
  },
  {
    big: "1 format",
    text: "delivered. Want a version for Reels? Pay again.",
    scribble: "vertical = new invoice",
    doodle: doodle("M6 14 h28 v18 h-28 z M36 10 v28 M40 10 v28 M30 22 l6 0"),
  },
];

const COMPARISON = [
  { label: "Starting point", doodle: [false, "A blank canvas"], ai: [true, "A prompt"], us: "Your script" },
  { label: "Storyboard", doodle: [false, "Built by hand"], ai: [false, "Generated, hard to edit"], us: "Generated, editable scene by scene" },
  { label: "Voice and drawing sync", doodle: [false, "Manual timing"], ai: [true, "Automatic"], us: "Automatic, word by word" },
  { label: "Teamwork", doodle: [false, "Files passed around"], ai: [false, "Depends on the tool"], us: "Shared workspace, roles, edit lock" },
  { label: "Formats", doodle: [false, "One export per format"], ai: [false, "Depends on the tool"], us: "16:9, 9:16, 1:1 from one project" },
] as const;

const TEAM_POINTS = [
  ["One workspace per team or client.", "Every project in one place, with previews and scene counts."],
  ["Clear roles.", "Owner, admin, member: everyone edits what they should."],
  ["An edit lock.", "When someone is working on a project, everyone else sees it."],
  ["Email invitations.", "A teammate or client joins the workspace in one click."],
];

const TEAM_ROWS = [
  { t: "Onboarding — new billing", m: "6 scenes · 16:9 · edited 4 min ago", pill: "Lea is editing", lock: true },
  { t: "v2 launch teaser", m: "4 scenes · 9:16", pill: "Ready", lock: false },
  { t: "Nordik client — explainer", m: "8 scenes · 1:1", pill: "Draft", lock: false },
];

const VS_COLUMNS = [
  { key: "doodle", name: "Doodle software", sub: "VideoScribe, Doodly" },
  { key: "ai", name: "AI video generators", sub: "Golpo AI" },
  { key: "us", name: "", sub: "Script to video, with your team" },
] as const;

function Mark({ ok = false }: { ok?: boolean }) {
  return <span className={`vs-mark sk-hand ${ok ? "is-ok" : "is-no"}`} aria-label={ok ? "Yes" : "No"}>{ok ? "✓" : "✗"}</span>;
}

function SectionHead({ eyebrow, title, lede }: { eyebrow: string; title: React.ReactNode; lede?: string }) {
  return (
    <div className="sec-head">
      <p className="sk-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {lede && <p className="sec-lede">{lede}</p>}
    </div>
  );
}

function Rule() {
  return <div className="sk-wrap" aria-hidden="true"><div style={{ borderTop: "1.5px dashed var(--sk-rule)" }} /></div>;
}

type SketchLandingProps = {
  user?: { name: string; email: string; image?: string | null } | null;
  isAdmin?: boolean;
};

export function SketchLanding({ user, isAdmin }: SketchLandingProps) {
  return (
    <div className="sketch">
      <Header user={user} isAdmin={isAdmin} />

      <main>
        <section className="sk-wrap hero">
          <div className="hero-copy">
            <h1>
              Your customers don&apos;t read.
              <br />
              <span className="sk-hl">Draw it for them.</span>
            </h1>
            <p className="hero-lede">
              Paste your text: {appConfig.name} turns it into a hand-drawn explainer video with voiceover. Ready for LinkedIn, YouTube and Reels, no agency needed.
            </p>
            <HeroPrompt />
            <p className="sk-note hero-try">↑ try it with your own text</p>
          </div>

          <div className="hero-demo">
            <div className="hero-tabs" aria-hidden="true">
              <span className="sk-eyebrow">Preview</span>
              <span className="hero-tab is-on"><i style={{ width: 18, height: 10 }} />16:9</span>
              <span className="hero-tab"><i style={{ width: 8, height: 14 }} />9:16</span>
              <span className="hero-tab"><i style={{ width: 12, height: 12 }} />1:1</span>
            </div>
            <div className="hero-board">
              <EngineScene />
              <span className="hero-sticky is-top" aria-hidden="true">voiceover synced word by word ✓</span>
              <span className="hero-sticky is-bottom" aria-hidden="true">4 hand styles ✍</span>
            </div>
            <div className="hero-voice" aria-hidden="true">
              <span className="hero-play">▶</span>
              <span className="hero-wave">
                {[6, 12, 18, 9, 22, 14, 26, 17, 10, 20, 28, 13, 7, 18, 24, 11, 6, 15, 21, 9, 16, 8, 19, 12, 7, 17, 25, 13, 9, 5].map((h, i) => (
                  <i key={i} style={{ height: h, opacity: i < 16 ? 1 : 0.35 }} />
                ))}
              </span>
              <span className="sk-mono hero-voice-meta">Nova · English</span>
            </div>
            <p className="sk-note hero-video-note">drawn live by our engine ↑</p>
          </div>
        </section>

        <Rule />

        <section className="sk-section sk-wrap">
          <SectionHead
            eyebrow="What a video costs today"
            title={<><span className="sk-strike">2 weeks</span> of waiting for 90 seconds of video.</>}
            lede="Brief, freelancer, three rounds of feedback, then redo it all for vertical. The result: one video a quarter instead of one a week."
          />
          <ul className="pain">
            {PAINS.map((p, i) => (
              <li key={p.big} className="pain-card" style={{ transform: `rotate(${[-2, 1.5, -1][i]}deg)` }}>
                <span className="shot-tape" aria-hidden="true" />
                <span className="pain-doodle" aria-hidden="true">{p.doodle}</span>
                <span className="pain-big sk-display">{p.big}</span>
                <p className="pain-text">{p.text}</p>
                <span className="pain-scribble sk-hand" aria-hidden="true">{p.scribble}</span>
              </li>
            ))}
          </ul>
          <div className="pain-verdict">
            <span className="pain-verdict-arrow" aria-hidden="true"><HandArrow variant="down-left" /></span>
            <p className="pain-verdict-text">
              With {appConfig.name}: <span className="sk-hl">one tool, every format, from the same project.</span>
            </p>
          </div>
        </section>

        <Rule />

        <section id="how-it-works" className="sk-section sk-wrap">
          <SectionHead
            eyebrow="From text to video, in one tool"
            title={<>Your first video, <span className="sk-hl">screen by screen.</span></>}
            lede={`Here's exactly what you do in ${appConfig.name}, from an empty project to an exported video. No animation skills needed.`}
          />
          <HowItWorks />
        </section>

        <Rule />

        <section className="sk-section sk-wrap">
          <SectionHead
            eyebrow="Compared to the alternatives"
            title={<>Doodle software makes you do everything. <span className="sk-hl">AI generators decide for you.</span></>}
            lede={`${appConfig.name} automates what takes hours and leaves you in control of what makes your brand.`}
          />
          <div className="vs">
            {VS_COLUMNS.map((col) => (
              <div key={col.key} className={`vs-col ${col.key === "us" ? "is-us" : ""}`}>
                {col.key === "us" && <span className="shot-tape" aria-hidden="true" />}
                {col.key === "us" && <span className="sk-note vs-us-note" aria-hidden="true">that&apos;s us ↓</span>}
                <div className="vs-col-head">
                  <h3>{col.key === "us" ? appConfig.name : col.name}</h3>
                  <small>{col.sub}</small>
                </div>
                <dl className="vs-rows">
                  {COMPARISON.map((row) => {
                    const [ok, value] = col.key === "us" ? [true, row.us] : row[col.key];
                    return (
                      <div key={row.label} className="vs-row">
                        <dt>{row.label}</dt>
                        <dd><Mark ok={ok} />{value}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        <section className="sk-section sk-wrap team">
          <div className="team-copy">
            <SectionHead
              eyebrow="For marketing teams and agencies"
              title={<>The whole team on the same videos. <span className="sk-hl">Nobody overwrites anyone.</span></>}
            />
            <ul className="team-list">
              {TEAM_POINTS.map(([t, d]) => (
                <li key={t}>
                  <span className="team-check sk-hand" aria-hidden="true">✓</span>
                  <span><b>{t}</b> <span className="team-desc">{d}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="team-visual">
            <div className="team-sheet">
              <span className="shot-tape" aria-hidden="true" />
              <p className="sk-eyebrow team-sheet-title">Acme agency · Projects</p>
              {TEAM_ROWS.map((r) => (
                <div key={r.t} className={`team-row ${r.lock ? "is-locked" : ""}`}>
                  <div className="team-row-main">
                    <b>{r.t}</b>
                    <small className="sk-mono">{r.m}</small>
                  </div>
                  <span className="team-pill sk-mono">{r.pill}</span>
                </div>
              ))}
            </div>
            <div className="team-callout" aria-hidden="true">
              <span className="team-callout-arrow"><HandArrow variant="down-left" /></span>
              <span className="sk-postit">locked while Lea edits, nobody overwrites her</span>
            </div>
          </div>
        </section>

        <Rule />

        <section id="savings" className="sk-section sk-wrap">
          <SectionHead
            eyebrow="Do the math"
            title={<>How much do your videos <span className="sk-hl">cost you today?</span></>}
            lede="Plug in your own numbers and compare them with a flat subscription. Nothing is sent anywhere."
          />
          <SavingsCalculator />
        </section>

        <Rule />

        <section id="pricing" className="sk-section sk-wrap">
          <SectionHead
            eyebrow="Monthly pricing"
            title={<>A full year costs less than <span className="sk-hl">one outsourced video.</span></>}
          />
          <div className="plans">
            {PLANS.map((p) => (
              <div key={p.name} className={`plan ${p.pick ? "is-pick" : ""}`}>
                {p.pick && <span className="shot-tape" aria-hidden="true" />}
                {p.pick && <span className="plan-flag sk-hand">best for teams</span>}
                <h3>{p.name}</h3>
                <p className="plan-price">
                  <span className="sk-display">${p.monthly}</span>
                  <span className="plan-per">/ month</span>
                </p>
                <p className="plan-note">{p.note}</p>
                <ul className="plan-items">
                  {p.items.map((it) => (
                    <li key={it}><span className="sk-hand" aria-hidden="true">✓</span>{it}</li>
                  ))}
                </ul>
                <Link href={p.name === "Enterprise" ? "/contact" : "/signup"} className={`sk-btn ${p.pick ? "sk-btn-main" : ""}`} style={{ justifyContent: "center" }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        <section className="sk-section sk-wrap faq">
          <div className="faq-side">
            <SectionHead eyebrow="FAQ" title={<>Before you <span className="sk-hl">get started</span></>} />
            <div className="faq-help">
              <p className="sk-note">still unsure?</p>
              <Link href="/contact" className="sk-btn">Book a demo →</Link>
            </div>
          </div>
          <div className="faq-list">
            {sketchFaqs.map((f) => (
              <details key={f.question} className="sk-faq">
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="sk-wrap final">
          <div className="final-card">
            <p className="sk-note final-note">your next video starts with a few lines of text</p>
            <h2>
              Finally ship the video you&apos;ve been putting off all quarter.
            </h2>
            <div className="final-actions">
              <Link href="/signup" className="sk-btn sk-btn-main">Create my first video →</Link>
              <Link href="/contact" className="sk-btn final-ghost">Book a demo</Link>
            </div>
            <span className="final-arrow" aria-hidden="true"><HandArrow variant="curve-left" /></span>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
