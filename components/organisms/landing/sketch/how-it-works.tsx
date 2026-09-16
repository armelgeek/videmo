import { Capture, type Mark } from "./capture";
import { HandArrow } from "./hand-arrow";
import { appConfig } from "@/lib/config";

type Step = {
  where: string;
  title: string;
  points: string[];
  captures?: { src: string; alt: string; marks: Mark[]; height?: number }[];
};

const STEPS: Step[] = [
  {
    where: "Prompt",
    title: "Say what the video is about",
    points: [
      "Write your message and key points, like you'd explain them to a colleague. No naming, no setup screen.",
      "Pick the type (Brief or Explainer), the format and the length.",
      "Then the language and the voice — press play to hear it before you commit a whole video to it.",
      `${appConfig.name} writes the script from it — reread it, or regenerate it.`,
    ],
    captures: [
      {
        src: "/landing/step-2-prompt.jpg",
        alt: `${appConfig.name} prompt screen: your brief on the left, the generated script on the right`,
        height: 738,
        marks: [
          { x: 10, y: 33, w: 39, h: 19, label: "your brief", side: "below" },
          { x: 52, y: 32, w: 17, h: 8, label: "the script, written for you", side: "above" },
        ],
      },
      {
        src: "/landing/step-1b-voice.jpg",
        alt: `${appConfig.name} voice picker: eight languages, and every voice playable before you choose`,
        height: 684,
        marks: [
          { x: 11, y: 47, w: 11, h: 42, label: "8 languages", side: "above" },
          { x: 27, y: 55, w: 23, h: 35, label: "hear it first", side: "above" },
        ],
      },
    ],
  },
  {
    where: "Storyboard",
    title: "Review the storyboard, scene by scene",
    points: [
      `${appConfig.name} splits your text into scenes, writes the narration and illustrates each one.`,
      "Rewrite a title or a line, or redraw a visual with “Redraw”.",
      "Reorder, duplicate or delete a scene without touching the others.",
    ],
    captures: [{
      src: "/landing/step-3-storyboard.jpg",
      alt: `${appConfig.name} storyboard: one card per scene, with the selected scene open for editing`,
      height: 738,
      marks: [
        { x: 10, y: 21, w: 18, h: 36, label: "one card per scene", side: "below" },
        { x: 65, y: 59, w: 24, h: 21, label: "rewrite it, or redraw it", side: "above" },
      ],
    }],
  },
  {
    where: "Voiceover",
    title: "The voice lands, the drawing follows",
    points: [
      "The narration is generated with the voice you picked, then transcribed word by word.",
      "Each element is drawn the moment it's spoken. No manual timing.",
    ],
    captures: [{
      src: "/landing/step-4-whiteboard.jpg",
      alt: `${appConfig.name} whiteboard: the scene being drawn, with its narration beside it`,
      height: 738,
      marks: [
        { x: 0.5, y: 17, w: 15, h: 24, label: "jump between scenes", side: "below" },
        { x: 79, y: 44, w: 20, h: 20, label: "the voice, scene by scene", side: "above" },
      ],
    }],
  },
  {
    where: "Export Video",
    title: "Export and publish",
    points: [
      "Open “Export”, choose the quality (up to 1920x1080) and start the render.",
      "Download the video and post it wherever your customers are watching.",
    ],
    captures: [{
      src: "/landing/step-5-export.jpg",
      alt: `${appConfig.name} export dialog: pick a resolution and start the render`,
      height: 684,
      marks: [
        { x: 37, y: 44, w: 25, h: 12, label: "pick your quality", side: "above" },
      ],
    }],
  },
];

export function HowItWorks() {
  return (
    <ol className="how">
      {STEPS.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <li key={s.title} className={`how-step ${flip ? "is-flip" : ""} ${s.captures ? "" : "is-text"}`}>
            {s.captures && (
              <div className="how-visual">
                {s.captures.map((c, n) => (
                  <Capture key={c.src} {...c} tilt={(flip ? 1 : -1) * (n % 2 ? -1 : 1)} />
                ))}
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
