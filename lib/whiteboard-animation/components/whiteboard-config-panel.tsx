'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WhiteboardConfig } from '@/lib/storyboard/store';

interface WhiteboardConfigPanelProps {
  config: WhiteboardConfig;
  onChange: (config: Partial<WhiteboardConfig>) => void;
}

export function WhiteboardConfigPanel({
  config,
  onChange,
}: WhiteboardConfigPanelProps) {
  return (
    <div className="space-y-6 p-6 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Whiteboard Settings</h3>

      {/* Animation Style */}
      <div className="grid gap-2">
        <Label>Animation Style</Label>
        <Select
          value={config.animStyle}
          onValueChange={(val) => onChange({ animStyle: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="chunkjump">ChunkJump</SelectItem>
            <SelectItem value="contour">Contour</SelectItem>
            <SelectItem value="gesture">Gesture</SelectItem>
            <SelectItem value="illust">Illustration</SelectItem>
            <SelectItem value="nervous">Nervous</SelectItem>
            <SelectItem value="outlinechunks">Outline Chunks</SelectItem>
            <SelectItem value="outlinefill">Outline Fill</SelectItem>
            <SelectItem value="outlineonly">Outline Only</SelectItem>
            <SelectItem value="scanner">Scanner</SelectItem>
            <SelectItem value="scribble">Scribble</SelectItem>
            <SelectItem value="spec-text">Spec Text</SelectItem>
            <SelectItem value="specialized">Specialized</SelectItem>
            <SelectItem value="topanchor">Top Anchor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hand Style */}
      <div className="grid gap-2">
        <Label>Hand Style</Label>
        <Select
          value={config.handStyle}
          onValueChange={(val) => onChange({ handStyle: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom1">Hand 1</SelectItem>
            <SelectItem value="custom2">Hand 2</SelectItem>
            <SelectItem value="custom3">Hand 3</SelectItem>
            <SelectItem value="custom4">Hand 4</SelectItem>
            <SelectItem value="ghost">Ghost</SelectItem>
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
          region — voir tuilesPourRegion — pour un rayon identique partout. Il
          ne concernait de toute facon que 4 styles sur 13. */}

      {/* Canvas Background */}
      <div className="grid gap-2">
        <Label>Canvas Background</Label>
        <Select
          value={config.canvasBg}
          onValueChange={(val) => onChange({ canvasBg: val })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="black">Black</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pas d'interrupteur Show Annotations : l'animation EST pilotee par les
          annotations, ce n'est pas une option. Le calque de reperage se retire
          de lui-meme pendant la lecture et revient a l'arret — voir le canvas
          d'annotations dans whiteboard-editor-step. */}

      {/* Ni Aspect Ratio ni Resolution ici. Le ratio est un parametre de
          PROJET (projectParams, choisi des l'etape Prompt) : le dupliquer dans
          la config whiteboard donnait deux sources pour la meme chose. La
          resolution est un choix d'EXPORT ; l'apercu rend au petit cote 720. */}

    </div>
  );
}
