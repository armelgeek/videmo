import Image from "next/image";

/**
 * Une capture de l'application, entouree a la main.
 *
 * Extrait de how-it-works.tsx : la section equipe montre elle aussi un ecran
 * reel, et dupliquer le trace de l'ellipse aurait fait diverger les deux au
 * premier ajustement.
 *
 * Les reperes sont en POURCENTAGES de la capture, jamais en pixels : une
 * capture reprise a une autre definition garde alors ses annotations au bon
 * endroit.
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
 * Une ellipse tracee au feutre : jamais tout a fait fermee, jamais tout a fait
 * ronde. Un cercle parfait se lirait comme un element d'interface, pas comme
 * une annotation posee par-dessus.
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
