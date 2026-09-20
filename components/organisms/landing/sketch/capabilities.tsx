import { VOICES } from '@/lib/speech/speech-generator';

/**
 * The three things the page says nowhere else.
 *
 * The list used to have five, including ratios and the style count: the former
 * are already in the hero, the comparison table AND the FAQ; the latter comes
 * right below the section showing the twelve styles on screen. A repeated
 * capability no longer gets read, it just fills space.
 *
 * The voice count is derived from speech-generator.ts: removing one fixes the
 * showcase in the same commit.
 */
const doodle = (d: string) => (
  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CAPACITES = [
  {
    cle: 'voix',
    doodle: doodle('M14 20 v8 M20 15 v18 M26 11 v26 M32 17 v14 M38 22 v4 M8 23 v2'),
    titre: (
      <>
        <span className="sk-hl">{VOICES.length} voices</span>, and each one is
        multilingual.
      </>
    ),
    texte:
      'The same voice reads French and English, so a second language costs you a click, not a second casting.',
    scribble: 'listen before you commit',
  },
  {
    cle: 'illustrations',
    doodle: doodle(
      'M10 38 l6 -2 22 -22 -4 -4 -22 22 z M32 12 l4 4 M12 10 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z',
    ),
    titre: (
      <>
        You write the script. <span className="sk-hl">It draws itself.</span>
      </>
    ),
    texte:
      'Scenes are illustrated for you, then traced by hand on the board. No stock library to dig through, no illustrator to brief.',
    scribble: 'no blank canvas',
  },
  {
    cle: 'rendu',
    doodle: doodle('M8 14 h32 v20 h-32 z M8 14 l16 12 16 -12 M14 40 h20'),
    titre: (
      <>
        Close the tab. <span className="sk-hl">The link lands in your inbox.</span>
      </>
    ),
    texte:
      'Long exports run on our servers, not in your browser. You get an email with the download when it is done.',
    scribble: 'nothing to babysit',
  },
];

export function Capabilities() {
  return (
    <div className="sk-section sk-wrap">
      <div className="sec-head">
        <p className="sk-eyebrow">Beyond the drawing</p>
        <h2>
          The parts that usually need{' '}
          <span className="sk-hl">three other tools.</span>
        </h2>
      </div>

      <ul className="capacites">
        {CAPACITES.map((c) => (
          <li key={c.cle} className="capacite">
            <span className="capacite-doodle">{c.doodle}</span>
            <h3 className="capacite-titre">{c.titre}</h3>
            <p className="capacite-texte">{c.texte}</p>
            <span className="capacite-scribble sk-hand">{c.scribble}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
