"use client";

import { memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WhiteboardConfig } from "@/lib/storyboard/store";

interface WhiteboardConfigPanelProps {
  config: WhiteboardConfig;
  onChange: (config: Partial<WhiteboardConfig>) => void;
}

/** Cles acceptees par AnimationFactory.create — voir lib/index.js. */
const ANIM_STYLES = [
  { value: "chunkjump", label: "Chunk Jump" },
  { value: "contour", label: "Contour" },
  { value: "gesture", label: "Gesture" },
  { value: "illust", label: "Illustration" },
  { value: "nervous", label: "Nervous" },
  { value: "outlinechunks", label: "Outline Chunks" },
  { value: "outlinefill", label: "Outline Fill" },
  { value: "outlineonly", label: "Outline Only" },
  { value: "scanner", label: "Scanner" },
  { value: "scribble", label: "Scribble" },
  { value: "spec-text", label: "Spec Text" },
  { value: "specialized", label: "Specialized" },
  { value: "topanchor", label: "Top Anchor" },
] as const;

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </span>
  );
}

function WhiteboardConfigPanelImpl({
  config,
  onChange,
}: WhiteboardConfigPanelProps) {
  return (
    <div className="w-full flex flex-col min-w-0 items-center gap-4">
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

/**
 * Settings do not move when the playing clip does, but this panel was the most
 * expensive subtree to re-render in the editor — which happens on every
 * handover. Memoised against a config object and an onChange that both hold
 * their identity across those renders.
 */
export const WhiteboardConfigPanel = memo(WhiteboardConfigPanelImpl);
