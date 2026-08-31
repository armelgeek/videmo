'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { WhiteboardConfig } from '@/lib/storyboard/store';

interface WhiteboardConfigPanelProps {
  config: WhiteboardConfig;
  onChange: (config: Partial<WhiteboardConfig>) => void;
}

/** Cles acceptees par AnimationFactory.create — voir lib/index.js. */
const ANIM_STYLES = [
  { value: 'chunkjump', label: 'Chunk Jump' },
  { value: 'contour', label: 'Contour' },
  { value: 'gesture', label: 'Gesture' },
  { value: 'illust', label: 'Illustration' },
  { value: 'nervous', label: 'Nervous' },
  { value: 'outlinechunks', label: 'Outline Chunks' },
  { value: 'outlinefill', label: 'Outline Fill' },
  { value: 'outlineonly', label: 'Outline Only' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'scribble', label: 'Scribble' },
  { value: 'spec-text', label: 'Spec Text' },
  { value: 'specialized', label: 'Specialized' },
  { value: 'topanchor', label: 'Top Anchor' },
] as const;

/**
 * Les mains sont un choix purement VISUEL : un menu "Hand 1 / Hand 2" ne dit
 * rien de ce qu'on choisit. On montre donc le sprite reel — le meme fichier que
 * charge use-whiteboard-renderer — sur une pastille blanche, miniature de la
 * page sur laquelle il dessinera.
 *
 * `ghost` n'est pas une main : le renderer sort avant de peindre le sprite. Elle
 * se presente donc comme une absence, pas comme une cinquieme main.
 */
const HANDS = [
  { value: 'custom1', label: 'Hand 1', src: '/images/hand1-720p.png' },
  { value: 'custom2', label: 'Hand 2', src: '/images/hand2-720p.png' },
  { value: 'custom3', label: 'Hand 3', src: '/images/hand3-720p.png' },
  { value: 'custom4', label: 'Hand 4', src: '/images/hand4-720p.png' },
  { value: 'ghost', label: 'No hand', src: null },
] as const;

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

export function WhiteboardConfigPanel({
  config,
  onChange,
}: WhiteboardConfigPanelProps) {
  return (
    <div className="flex min-w-0 items-center gap-4">
      {/* Le style est LE choix creatif de cette etape — treize traces
          differents. Il ouvre donc la barre et porte le corps de texte le plus
          fort, la ou les mains se lisent d'un coup d'oeil. */}
      <div className="flex min-w-0 items-center gap-2">
        <GroupLabel>Style</GroupLabel>
        <Select
          value={config.animStyle}
          onValueChange={(val) => onChange({ animStyle: val })}
        >
          <SelectTrigger
            aria-label="Animation style"
            className="h-8 w-44 px-2.5 text-sm font-medium text-foreground"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ANIM_STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-sm">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <GroupLabel>Hand</GroupLabel>
        <div role="radiogroup" aria-label="Hand" className="flex items-center gap-1">
          {HANDS.map((hand) => {
            const selected = config.handStyle === hand.value;
            return (
              <button
                key={hand.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={hand.label}
                title={hand.label}
                onClick={() => onChange({ handStyle: hand.value })}
                className={cn(
                  'relative h-8 w-8 shrink-0 overflow-hidden rounded bg-[#f6f6f4] transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'ring-2 ring-primary'
                    : 'opacity-55 ring-1 ring-border hover:opacity-100',
                )}
              >
                {hand.src ? (
                  <img
                    src={hand.src}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full object-contain p-0.5"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="h-3 w-3 rounded-full border border-dashed border-neutral-400" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pas de curseur Reveal Speed : il ne changeait pas la façon de dessiner
          mais l'horloge du moteur, donc la vitesse a laquelle on parcourt la
          timeline. Or reveal.from/to sont des timestamps de la NARRATION : tout
          multiplicateur ferait deriver le dessin par rapport a sa bande-son.
          Le champ reste dans la config (projets deja enregistres) mais n'est
          plus lu : le moteur tourne toujours au 1x fidele. */}

      {/* Pas de curseur Hand Speed : en mode annotation la vitesse du trace est
          imposee par la fenetre de l'annotation (reveal.from/to), et paceStep
          ecrase la valeur — le curseur ne changeait rien a l'ecran. Le champ
          handSpeed reste dans la config, il sert encore au mode sans
          annotation. Le rebrancher demanderait de lui donner un sens qui
          n'entre pas en conflit avec la duree, ce qui reste a concevoir. */}

      {/* Pas de curseur Chunks : il fixait un NOMBRE de tuiles, or le rayon du
          trait derive de leur TAILLE. A nombre constant le stylo changeait
          d'epaisseur selon la region (rayon 6 sur l'etiquette, 12 sur le sac,
          dans le meme dessin). Le nombre se deduit desormais de l'aire de la
          region — voir tuilesPourRegion — pour un rayon identique partout. */}

      {/* Pas de choix de Canvas Background : le fond est toujours blanc. Les
          styles de trace et les sprites de main sont calibres dessus ; "black"
          et "none" donnaient un rendu que rien n'accompagnait. Le champ
          canvasBg reste dans la config pour les projets deja enregistres, mais
          l'etape force "white". */}

      {/* Ni Aspect Ratio ni Resolution ici. Le ratio est un parametre de
          PROJET (projectParams, choisi des l'etape Prompt) : le dupliquer dans
          la config whiteboard donnait deux sources pour la meme chose. La
          resolution est un choix d'EXPORT ; l'apercu rend au petit cote 720. */}
    </div>
  );
}
