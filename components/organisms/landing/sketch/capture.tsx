import Image from "next/image";

/**
 * An app screenshot, circled by hand.
 *
 * Extracted from how-it-works.tsx: the team section also shows a real screen,
 * and duplicating the ellipse path would have made the two diverge at the first
 * tweak.
 *
 * Marks are in PERCENTAGES of the screenshot, never pixels: a screenshot
 * retaken at another resolution then keeps its annotations in the right
 * place.
 */
export type Mark = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  side?: "above" | "below";
};

/**
 * An ellipse drawn in marker: never quite closed, never quite round. A perfect
 * circle would read as a UI element, not as an annotation laid on top.
 */
export function ellipsePath(w: number, h: number) {
  return `M ${w * 0.52} 3 C ${w * 0.9} 1, ${w - 2} ${h * 0.3}, ${w - 3} ${h * 0.55} C ${w - 5} ${h * 0.9}, ${w * 0.6} ${h - 2}, ${w * 0.4} ${h - 3} C ${w * 0.1} ${h - 4}, 2 ${h * 0.7}, 3 ${h * 0.42} C 5 ${h * 0.12}, ${w * 0.3} 2, ${w * 0.62} 6`;
}

export function Capture({
  src,
  alt,
  marks,
  tilt = 0,
  width = 1568,
  height = 683,
}: {
  src: string;
  alt: string;
  marks: Mark[];
  tilt?: number;
  width?: number;
  height?: number;
}) {
  return (
    <figure className="shot" style={{ transform: `rotate(${tilt}deg)` }}>
      <span className="shot-tape" aria-hidden="true" />
      <div className="shot-img">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 860px) 100vw, 600px"
        />
        {marks.map((m) => (
          <span
            key={m.label}
            className="shot-mark"
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: `${m.w}%`,
              height: `${m.h}%`,
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={ellipsePath(100, 100)}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            </svg>
            <span className={`shot-label sk-hand ${m.side === "below" ? "is-below" : ""}`}>
              {m.label}
            </span>
          </span>
        ))}
      </div>
    </figure>
  );
}
