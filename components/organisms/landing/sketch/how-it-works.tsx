import Image from "next/image";
import { HandArrow } from "./hand-arrow";
import { appConfig } from "@/lib/config";

type Mark = { x: number; y: number; w: number; h: number; label: string; side?: "above" | "below" };

type Step = {
  where: string;
  title: string;
  points: string[];
  capture?: { src: string; alt: string; marks: Mark[] };
};

const STEPS: Step[] = [
  {
    where: "New project",
    title: "Name your project and pick a format",
    points: [
      "Click “New project” from your workspace.",
      "Give it a name, then choose a format: Landscape for YouTube and your website, Portrait for Reels and Shorts, Square for feeds.",
      "Click “Create project”.",
    ],
    capture: {
      src: "/landing/step-1-new-project.jpg",
      alt: `${appConfig.name} New project screen: project name and format picker`,
      marks: [
        { x: 36, y: 49, w: 44, h: 20, label: "pick the format upfront", side: "above" },
        { x: 70, y: 78, w: 10, h: 8, label: "and you're off", side: "below" },
      ],
    },
  },
  {
    where: "Create Your Video",
    title: "Describe your video, in one sentence or ten",
    points: [
      "Set the style, the type (Brief or Explainer), the tone, the audience, the voice and the hand.",
      "Write your message and key points, like you'd explain them to a colleague.",
      "Choose the ratio, length and language, then send.",
    ],
    capture: {
      src: "/landing/step-2-create-video.jpg",
      alt: `${appConfig.name} Create Your Video screen: settings and concept description`,
      marks: [
        { x: 31, y: 28, w: 38, h: 15, label: "style, tone, voice, hand", side: "above" },
        { x: 28, y: 45, w: 44, h: 19, label: "your brief goes here", side: "below" },
      ],
    },
  },
  {
    where: "Storyboard",
    title: "Review the storyboard, scene by scene",
    points: [
      `${appConfig.name} splits your text into scenes, writes the narration and illustrates each one.`,
      "Rewrite a title or a line, or redraw a visual with “Redraw”.",
      "Reorder, duplicate or delete a scene without touching the others.",
    ],
  },
  {
    where: "Voiceover",
    title: "The voice lands, the drawing follows",
    points: [
      "The narration is generated with the voice you picked, then transcribed word by word.",
      "Each element is drawn the moment it's spoken. No manual timing.",
    ],
  },
  {
    where: "Export Video",
    title: "Export and publish",
    points: [
      "Open “Export”, choose the quality (up to 1920x1080) and start the render.",
      "Download the video and post it wherever your customers are watching.",
    ],
  },
];

function ellipsePath(w: number, h: number) {
  return `M ${w * 0.52} 3 C ${w * 0.9} 1, ${w - 2} ${h * 0.3}, ${w - 3} ${h * 0.55} C ${w - 5} ${h * 0.9}, ${w * 0.6} ${h - 2}, ${w * 0.4} ${h - 3} C ${w * 0.1} ${h - 4}, 2 ${h * 0.7}, 3 ${h * 0.42} C 5 ${h * 0.12}, ${w * 0.3} 2, ${w * 0.62} 6`;
}

function Capture({ src, alt, marks, tilt }: { src: string; alt: string; marks: Mark[]; tilt: number }) {
  return (
    <figure className="shot" style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="shot-tape" aria-hidden="true" />
      <div className="shot-img">
        <Image src={src} alt={alt} width={1568} height={683} sizes="(max-width: 860px) 100vw, 600px" />
        {marks.map((m) => (
          <span key={m.label} className="shot-mark" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d={ellipsePath(100, 100)} fill="none" stroke="currentColor" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </svg>
            <span className={`shot-label sk-hand ${m.side === "below" ? "is-below" : ""}`}>{m.label}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}

export function HowItWorks() {
  return (
    <ol className="how">
      {STEPS.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <li key={s.title} className={`how-step ${flip ? "is-flip" : ""} ${s.capture ? "" : "is-text"}`}>
            {s.capture && (
              <div className="how-visual">
                <Capture {...s.capture} tilt={flip ? 1 : -1} />
              </div>
            )}
            <div className="how-text">
              <span className="how-num sk-hand" aria-hidden="true">{i + 1}</span>
              <p className="sk-eyebrow">Step {i + 1} · {s.where}</p>
              <h3>{s.title}</h3>
              <ul>
                {s.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
            {i < STEPS.length - 1 && (
              <div className="how-link" aria-hidden="true">
                <HandArrow variant={flip ? "curve-left" : "curve-right"} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
