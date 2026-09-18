import type React from "react";
import Link from "next/link";
import { HeroPrompt } from "./hero-prompt";
import { HeroDemo } from "./hero-demo";
import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import { HowItWorks } from "./how-it-works";
import { Capture } from "./capture";
import { HandArrow } from "./hand-arrow";
import { appConfig } from "@/lib/config";
import { PricingPlans } from "./pricing-plans";
import { AnimationStylesShowcase } from "./animation-styles";
import { VideoGallerySection } from "./video-gallery";
import { Capabilities } from "./capabilities";
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
              Your script.
              <br />
              <span className="sk-hl">Drawn by hand, in 60 seconds.</span>
            </h1>
            <p className="hero-lede">
              Paste your text: {appConfig.name} turns it into a hand-drawn video that hooks attention from the first stroke. Voiceover included.
            </p>
            <HeroPrompt />
            <p className="sk-note hero-try">Type 2 lines above. Watch the hand do the rest ↑</p>
          </div>

          <HeroDemo />
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
            lede={`Here's exactly what you do in ${appConfig.name}, from a blank page to an exported video. No animation skills needed.`}
          />
          <HowItWorks />
        </section>

        <Rule />

        <section className="sk-section sk-wrap">
          <AnimationStylesShowcase />
        </section>

        <Rule />

        <section>
          <Capabilities />
        </section>

        <Rule />

        <section>
          <VideoGallerySection />
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
            <Capture
              src="/landing/workspace.jpg"
              alt={`${appConfig.name} workspace: the team's projects, members and credits in one place`}
              tilt={1}
              marks={[
                { x: 0.5, y: 8, w: 16, h: 9, label: "one workspace per team", side: "below" },
                { x: 71, y: 19, w: 27, h: 17, label: "who's on it", side: "above" },
              ]}
            />
          </div>
        </section>

        <Rule />

        <section id="pricing" className="sk-section sk-wrap">
          <SectionHead
            eyebrow="Pricing"
            title={<>Start free. <span className="sk-hl">Upgrade when you publish more.</span></>}
            lede="Every plan comes with monthly credits for scripts, storyboards, images and voiceover. No commitment, cancel anytime."
          />
          <PricingPlans />
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
