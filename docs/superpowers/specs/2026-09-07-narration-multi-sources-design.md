# La narration en plusieurs sources

**But :** que la piste de narration cesse d'être un fichier unique et redevienne
ce qu'elle est — une suite de temps, chacun avec sa voix.

## Pourquoi

La voix est produite **par temps de narration** : c'est ce qui permet de caler
chaque annotation sur la durée réellement dite. Mais l'aperçu et le rendu ne
savent jouer **qu'une** piste, `whiteboardConfig.audio`, remplie jusqu'ici par
un téléversement à la main.

Le chantier précédent a comblé le trou en collant les temps bout à bout
(`/api/narration-track`). Ça marche — la vidéo exportée est calée à 48 ms près —
mais c'est un contournement :

- refaire **un** temps oblige à reconcaténer toute la piste ;
- couper ou déplacer un temps désynchronise tout ce qui suit ;
- on ne peut ni couper ni régler le volume d'un temps seul ;
- la donnée ment : le modèle dit « une piste » là où la chaîne produit N.

## Ce qui rend le chantier abordable

**L'horloge murale possède déjà la timeline.** `use-whiteboard-renderer.ts`
le dit explicitement : le moteur avance sur `performance.now()`, et l'élément
audio est un *suiveur* qu'on repositionne — précisément parce qu'un média qui
bufferise ou cale ne doit pas arrêter le dessin.

Il n'y a donc pas d'horloge à réinventer. Passer de une à N sources revient à
choisir, à chaque frame, quel morceau doit jouer et à quelle position.

## Décisions

**Le modèle.** `whiteboardConfig.narration: NarrationPart[]`, chaque part
portant `url`, `startMs`, `durationMs`. Les parts ne se chevauchent pas : elles
se suivent, dérivées des mêmes durées que les annotations.

`whiteboardConfig.audio` **reste** : c'est la piste d'un téléversement à la
main, et celle des projets déjà enregistrés. Quand `narration` est renseignée,
elle prime ; sinon on retombe sur `audio`. Rien d'existant ne casse.

**L'aperçu.** Un module pur décide — `partAt(parts, positionMs)` rend le morceau
à jouer et la position dedans. La boucle de rendu l'interroge comme elle
resynchronise déjà sa source unique. Un seul élément audio suffit : les parts ne
se chevauchant pas, on change de `src` aux frontières.

**Le rendu.** N entrées ffmpeg, chacune retardée de son `startMs` (`adelay`),
puis mélangées (`amix`, `normalize=0` — sans quoi ffmpeg divise le volume par
le nombre d'entrées et la voix devient inaudible).

**Le silence** n'est pas une source. Un temps sans voix laisse simplement un
trou : `adelay` place les suivants à leur place absolue, il n'y a rien à
fabriquer. C'est plus simple que la concaténation, qui devait générer un silence.

## Ce qui reste hors de ce chantier

- Régler le volume ou couper un temps depuis l'éditeur : le modèle le permettra,
  l'interface viendra après.
- `/api/narration-track` **reste** : c'est le repli pour tout consommateur qui
  ne sait lire qu'une piste, et le chemin des projets anciens.

## Le risque à surveiller

Changer de `src` sur un élément audio n'est pas instantané : le navigateur
recharge. À la frontière entre deux temps, un retard de quelques dizaines de
millisecondes est possible. Le dessin, lui, ne l'attend pas — l'horloge murale
est maîtresse. À mesurer plutôt qu'à supposer : si le trou s'entend, il faudra
deux éléments qu'on alterne, l'un préchargeant pendant que l'autre joue.

---

## Ce qui a été fait, et ce qui a été mesuré

**Le rendu.** `narration-mix.js` construit le filtre, `canvas-renderer.js`
ajoute une entrée par temps. Test de fumée : une vidéo à deux voix décalées de
deux secondes, avec mesure du niveau — silence avant le second temps
(< −60 dB), son pendant (> −30 dB).

**L'aperçu.** `NarrationPlayer` présente à la boucle de rendu l'interface d'une
piste continue et traduit la position du projet en « quel morceau, où ». La
décision vit à part, dans `nextNarrationAction` : jsdom n'implémente ni `play`
ni `load`, donc un lecteur testé directement ne prouverait rien.

`AudioManager` reçoit un `follow()` qui ne fait rien — une piste unique n'a rien
à suivre. Les deux deviennent ainsi interchangeables pour la boucle.

**Vérifié dans l'application.** Trois morceaux persistés à leurs débuts absolus
(0, 5112, 7032 ms). Export relancé : l'audio de la vidéo dure **12144 ms**,
exactement la somme des temps — et non 12192 ms, la durée de la piste
concaténée. C'est la preuve que le chemin multi-sources a bien servi.

**Ce qui n'a pas été mesuré.** Le risque annoncé plus haut — le trou audible à
la frontière entre deux temps, quand l'élément recharge sa source — ne concerne
que l'aperçu, le rendu passant par ffmpeg. Il n'a pas été écouté. Si le trou
s'entend, la parade est notée : deux éléments qu'on alterne.
