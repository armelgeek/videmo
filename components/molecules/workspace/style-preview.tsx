import { cn } from "@/lib/utils";
import type { VisualStyle } from "@/lib/storyboard/visual-styles/types";

/**
 * Accent colours are written in the style's own words ("warm orange", "soft
 * green"), which are not CSS colours. Matching on the base word covers every
 * way they have been written so far; anything unrecognised just draws in ink.
 */
export const ACCENT_HEX: Record<string, string> = {
  red: "#e5484d",
  orange: "#f76b15",
  yellow: "#ffb224",
  green: "#30a46c",
  teal: "#12a594",
  blue: "#0091ff",
  purple: "#8e4ec6",
  pink: "#e93d82",
};

function accentsOf(style: VisualStyle): string[] {
  const found: string[] = [];
  for (const written of style.accentColors) {
    const word = written.toLowerCase();
    const base = Object.keys(ACCENT_HEX).find((name) => word.includes(name));
    if (base && !found.includes(ACCENT_HEX[base])) found.push(ACCENT_HEX[base]);
  }
  return found;
}

/**
 * The three hands a style can be drawn with.
 *
 * ponytail: read off the art direction, because a style has no field for it.
 * It sniffs the words the shipped styles and the editor's own placeholder
 * already use. Give `VisualStyle` a `hand` if this ever needs to be exact.
 */
type Hand = "precise" | "plain" | "bold";

function handOf(artDirection: string): Hand {
  const text = artDirection.toLowerCase();
  if (/\b(bold|thick|chunky|marker|heavy|comic|felt-tip|confident)\b/.test(text)) return "bold";
  if (/\b(thin|precise|fine|uniform|technical|minimal|icon|geometric|blueprint)\b/.test(text))
    return "precise";
  return "plain";
}

const STROKE: Record<Hand, number> = { precise: 1.3, plain: 2.1, bold: 3.6 };

/** A figure who has just had an idea: the shape of every explainer ever made. */
const FIGURE = {
  // Drawn as a path rather than a circle so the head carries the wobble of a
  // hand; the precise hand gets a truer one.
  head: {
    plain: "M44 21c6.5-.4 11.4 4.2 11.2 10.2C55 37 50.4 41.3 44.3 41.2 38 41 33.4 36.4 33.6 30.6 33.8 25 38 21.3 44 21z",
    precise: "M44 21a10.2 10.2 0 1 1-.1 20.4A10.2 10.2 0 0 1 44 21z",
  },
  body: {
    plain: "M44 41.5c.6 6 .7 11.6.2 17.4M34.2 48.4c6.8 1.6 13.2 1.5 19.8-.3M39 58.6c-1.4 4.2-3 7.8-5.2 11M49.4 58.6c1.6 4.2 3.4 7.7 5.6 10.8",
    precise: "M44 41.5v17.4M34 48h20M44 58.9l-6 11M44 58.9l6 11",
  },
};

/** The idea itself, where the accent colour lands. */
const BULB =
  "M133 26.5c7 0 12.6 5.4 12.6 11.8 0 4.2-2.6 6.4-4 9.2-.7 1.4-1 2.6-1.1 3.9h-15c-.1-1.3-.4-2.5-1.1-3.9-1.4-2.8-4-5-4-9.2 0-6.4 5.6-11.8 12.6-11.8z";
const BULB_BASE = "M126.5 55.8h13M128 60.4h10M130.5 64.5h5";
const RAYS = "M133 18.5v-5M117.5 24l-3.6-3.6M148.5 24l3.6-3.6M111 39.5h-5M155 39.5h5";

/** How the eye travels from the figure to the idea. */
const ARROW: Record<Hand, { line: string; head: string }> = {
  plain: {
    line: "M66 48c9-9 21-12 34-9",
    head: "M100 39l-8-2.4M100 39l-2.6 7.8",
  },
  bold: {
    line: "M66 50c10-11 23-13 34-9",
    head: "M100 41l-9-3M100 41l-3 8.6",
  },
  precise: {
    line: "M66 52h17v-9h17",
    head: "M100 43l-6-4M100 43l-6 4",
  },
};

/** What the drawing sits on, which is most of a style's mood. */
const GROUND: Record<Hand, string> = {
  plain: "M24 80c14-2.4 28-3 42-1.8M110 78.6c13-1.2 26-1 39 .6",
  bold: "M24 81h42M110 79.6h39",
  precise: "M22 80h140",
};

/**
 * Small marks read off the style's own vocabulary, so two styles that draw
 * with different things do not come out looking the same.
 */
function decorationOf(style: VisualStyle, hand: Hand): string {
  const words = style.vocabulary.join(" ").toLowerCase();
  if (/star/.test(words)) return "M72 15l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.3 2.8 1-5.9-4.2-4.2 5.9-.8z";
  if (/action|speed/.test(words)) return "M20 30h10M17 38h13M21 46h9";
  if (/bracket|callout|caption/.test(words)) return "M20 26h-5v28h5M166 26h5v28h-5";
  if (/check/.test(words)) return "M60 26l4 4 8-9";
  if (/scenery|landscape|tree/.test(words)) return "M14 80c6-12 13-12 19 0M160 80c5-10 11-10 16 0";
  if (/underline/.test(words)) return "M30 74h28M112 73h34";
  // Nothing named: the hand still leaves its own trace.
  return hand === "precise" ? "M20 26h-4v28h4" : "M70 18c3-3 7-3 9 0";
}

/**
 * A sample drawing in the style, so a style is chosen by looking rather than
 * by reading: a figure, an arrow, an idea — the scene every explainer draws —
 * traced the way this style would trace it.
 */
export function StylePreview({ style, className }: { style: VisualStyle; className?: string }) {
  const hand = handOf(style.artDirection);
  const stroke = STROKE[hand];
  const [accent, secondAccent] = accentsOf(style);
  const round = hand !== "precise";
  const wobbly = hand === "precise" ? "precise" : "plain";

  return (
    <svg
      viewBox="0 0 180 96"
      className={cn("h-full w-full bg-white", className)}
      role="img"
      aria-label={`A sample drawing in the ${style.label} style`}
    >
      <g
        fill="none"
        stroke="#16160f"
        strokeWidth={stroke}
        strokeLinecap={round ? "round" : "butt"}
        strokeLinejoin={round ? "round" : "miter"}
      >
        {/* The idea glows in the first accent, which is where colour is most
            worth spending on a drawing that is otherwise pure line work. */}
        {accent && <path d={BULB} fill={accent} fillOpacity={0.18} stroke="none" />}

        <path d={FIGURE.head[wobbly]} />
        <path d={FIGURE.body[wobbly]} />

        <path d={ARROW[hand].line} />
        <path d={ARROW[hand].head} />

        <path d={BULB} />
        <path d={BULB_BASE} strokeWidth={Math.max(1, stroke * 0.8)} />
        <path d={RAYS} stroke={accent ?? "#16160f"} strokeWidth={Math.max(1, stroke * 0.85)} />

        <path d={decorationOf(style, hand)} stroke={secondAccent ?? accent ?? "#16160f"} />

        <path d={GROUND[hand]} strokeWidth={Math.max(1, stroke * 0.75)} opacity={0.75} />

        {/* Where the style writes words, it writes them under its subjects. */}
        {style.labels !== "none" && (
          <g opacity={0.5} strokeWidth={Math.max(1, stroke * 0.7)}>
            <path d="M34 88h20" />
            {style.labels === "every-subject" && <path d="M122 88h22" />}
          </g>
        )}
      </g>
    </svg>
  );
}
