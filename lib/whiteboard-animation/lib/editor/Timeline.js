/**
 * Timeline — le cerveau temporel de la lecture, sorti de app/index.html.
 *
 * C'est la partie la plus fragile de l'editeur, et celle qui vient d'etre
 * deboguee : quand un fondu part, quelle duree porte une carte, ou se trouve
 * le curseur. Elle est donc reprise VERBATIM, avec la meme raison qu'au
 * moteur — la reecrire, c'est rejouer les bugs de timing un par un.
 *
 * Elle ne dessine RIEN. Les cartes, la regle et l'inspecteur sont du ressort
 * de l'hote (React) ; la tete de lecture reste en DOM direct chez lui, parce
 * qu'elle bouge a 60-140 Hz et qu'un re-render par frame est exclu. Ici il n'y
 * a que du temps.
 *
 * @param engine  le EditorEngine dont on partage l'etat
 * @param projet  acces au modele : scenes(), sceneLayer(sc), courant(), choisir(i)
 * @param hooks   ce que l'hote veut savoir
 */
'use strict';

const { buildProjectSchedule } = require('../index');

const TL_DUREE_DEFAUT = 3000;        // tant qu'une scene n'a jamais ete jouee
const TL_SEUIL_RECALAGE_MS = 250;    // au-dela, l'horloge se recale sur la voix

const HOOKS_DEFAUT = {
  onPlan() {},            // le plan a change : redessiner les cartes
  onPlayhead() {},        // (ratio) position de la tete, -1 = cacher
  onRafraichir() {},      // fin de lecture : resynchroniser les panneaux
  onAutosave() {},
  onBoutonLecture() {},
  narration: { stop() {}, element: () => null },
};

function createTimeline({ engine, projet, hooks = {} } = {}) {
  if (!engine) throw new Error('createTimeline: engine requis');
  if (!projet || typeof projet.scenes !== 'function') {
    throw new Error('createTimeline: projet.scenes() requis');
  }

  const E = engine;
  const P = projet;
  const H = { ...HOOKS_DEFAUT, ...hooks,
              narration: { ...HOOKS_DEFAUT.narration, ...(hooks.narration || {}) } };

  // L'etat est PARTAGE avec le moteur : _tlPlan, _tlHorlogeT0, sceneIndex,
  // playing... le decoupler obligerait a synchroniser deux copies a chaque
  // frame, ce qui est exactement la classe de bug qu'on vient de fermer.
  const state = E.state;

  // Cache de la forme d'onde, lu par _planTimeline pour la duree audio reelle.
  let _tlPicsUrl = null, _tlPicsMs = 0;

  // Timer de l'attente "fin de carte" avant le fondu, cf. _enchainerScene().
  let _attenteTransition = 0;

  function _annulerAttenteTransition() {
    if (_attenteTransition) clearTimeout(_attenteTransition);
    _attenteTransition = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Repris verbatim de app/index.html. Ne pas reecrire.
  // ═══════════════════════════════════════════════════════════════════════

  function _tlFmt(ms) {
    const t = Math.max(0, ms) / 1000;
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
  }

  function _bornesRegion(a) {
    const r = (a && a.reveal) || {};
    const f = Math.max(0, Number(r.from) || 0);
    return { debut: f, fin: Math.max(f + 1, Number(r.to) || 0) };
  }

  function _ecrireBornesRegion(a, debut, fin) {
    const r = a && a.reveal;
    if (!r) return;
    r.from = Math.round(Math.max(0, debut));
    r.to   = Math.round(Math.max(debut + 1, fin));
  }

  const _tlVignettes = new WeakMap();

  function _dureeScene(i, plan) {
    const sc = P.scenes()[i];
    if (!sc) return TL_DUREE_DEFAUT;
    // Une scene annotee a une duree EXACTE, donnee par son planning de regions.
    // Elle passe avant la mesure : sinon, rallonger une region a la souris ne
    // faisait pas bouger la carte, qui restait sur la duree du dernier passage.
    const p = plan && plan.scenes && plan.scenes[i];
    if (p && p.dureeMs > 0) return p.dureeMs;
    if (sc._dureeMs > 0) return sc._dureeMs;
    // _dureeProv : ce que la piste a appris pendant la lecture en cours, tant
    // que la scene n'est pas allee a son terme. Provisoire, donc apres _dureeMs.
    if (sc._dureeProv > 0) return sc._dureeProv;
    return TL_DUREE_DEFAUT;
  }

  /** Le plan temporel affiche : chaque scene avec son debut et sa duree. */

  function _planTimeline() {
    const l = P.scenes();
    let sched = null;
    try { sched = buildProjectSchedule(P.courant()); }
    catch (e) { sched = null; }

    let curseur = 0;
    const scenes = l.map((sc, i) => {
      const dureeMs = _dureeScene(i, sched);
      const t = sc.transition || {};
      const nom = t.transitionAfter || 'fade';
      // La transition occupe son propre creneau apres la scene : la suivante
      // n'entre qu'une fois le fondu fini.
      const transMs = (i === l.length - 1 || nom === 'none' || nom === 'cut')
        ? 0 : (t.transitionMs ?? 0);
      const bloc = { i, sc, startMs: curseur, dureeMs, endMs: curseur + dureeMs, transMs };
      curseur += dureeMs + transMs;
      return bloc;
    });

    const narr = (P.courant().narration) || null;
    const memeAudio = narr && narr.audioUrl && narr.audioUrl === _tlPicsUrl;
    const audioMs = (memeAudio && _tlPicsMs) || (narr && narr.durationMs) || 0;
    // La piste couvre le plus long des deux : sinon une voix plus longue que le
    // dessin sortait du cadre, et on ne voyait pas qu'il manquait de l'image.
    return { scenes, projetMs: curseur, audioMs, totalMs: Math.max(curseur, audioMs, 1) };
  }

  function _sceneAnnotee(i) {
    const l = P.scenes();
    return !!((( P.sceneLayer(l[i]) || {}).annotations || []).length);
  }

  /**
   * Redessine la piste sur la duree MESUREE de la scene i, qui vient d'etre
   * ecrite par _enchainerScene().
   *
   * Le plan ET les cartes, ensemble. Recaler le plan seul remettait le fondu a
   * l'heure mais laissait les cartes a l'ancienne echelle : le curseur, calcule
   * sur le nouveau totalMs, se retrouvait en retard sur une carte dessinee trop
   * longue (scene estimee 3000 ms pour un dessin de 2270 : bord de carte a
   * 29 %, curseur a 24 %). C'est le meme defaut que l'ancien etirement, dans
   * l'autre sens — la seule sortie est de tenir les deux sur la meme echelle.
   *
   * Appele une fois par scene, au moment ou le fondu couvre le canvas : c'est
   * l'instant ou une carte peut changer de taille sans que ca saute aux yeux. Au
   * passage suivant les durees sont connues, le redessin ne change plus rien.
   */

  function _recalerFinScene() {
    if (!state._tlPlan || !state._tlHorlogeT0) return;
    _rafraichirPlan();   // relit _dureeMs : plan et cartes repartent de la mesure
  }

  /**
   * Millisecondes restantes avant le bord droit de la carte de la scene i.
   *
   * Le fondu ne doit pas partir au dernier trait, mais a la fin de la CARTE : le
   * crayon s'arrete souvent avant, la fenetre d'une scene va jusqu'au `to` de sa
   * derniere region.
   *
   * Reserve aux scenes ANNOTEES : `to` fait foi, le trace a ete cadence pour
   * finir dessus, on attend donc sans plafond sinon le fondu part avant la fin
   * ecrite. Une scene sans annotation n'a rien a attendre (cf. _recalerFinScene).
   */

  function _resteAvantFinScene(i) {
    const plan = state._tlPlan;
    const bloc = plan && plan.scenes && plan.scenes[i];
    if (!bloc || !state._tlHorlogeT0) return 0;
    const t = state._tlHorlogeBase + (performance.now() - state._tlHorlogeT0);
    return Math.max(0, bloc.endMs - t);
  }

  /**
   * La transition a SA propre duree : pendant transitionMs rien ne se dessine,
   * on fond la derniere image de la scene sortante vers le FOND vide de
   * l'entrante, et l'entrante ne trace son premier trait qu'apres.
   *
   * @param pendant  bascule sur la scene entrante et n'affiche que son fond
   * @param apres    lance son dessin, une fois le fondu termine
   */

  function _demarrerHorlogeLecture(baseMs) {
    state._tlHorlogeBase = Math.max(0, baseMs || 0);
    state._tlHorlogeT0   = performance.now();
  }

  function _arreterHorlogeLecture() {
    state._tlHorlogeT0 = 0;
    _annulerAttenteTransition();
  }

  /**
   * Le curseur a SA boucle. Tant qu'il dependait de E.animate(), il se figeait
   * partout ou l'animation s'arrete : le fondu entre deux scenes, le pre-rendu
   * de la suivante, chaque a-coup du moteur. Mesure : 39 frames consecutives
   * sans bouger alors que le navigateur tournait a 60 fps. Un curseur de lecteur
   * video ne s'arrete pas parce que l'image met du temps a venir.
   */

  function _demarrerTickerCurseur() {
    if (state._tlTicker) return;
    const boucle = () => {
      if (!state.playing && !state._lectureProjet) { state._tlTicker = 0; return; }
      _majTeteLectureHorloge();
      state._tlTicker = requestAnimationFrame(boucle);
    };
    state._tlTicker = requestAnimationFrame(boucle);
  }

  function _arreterTickerCurseur() {
    if (state._tlTicker) cancelAnimationFrame(state._tlTicker);
    state._tlTicker = 0;
  }

  function _majTeteLectureHorloge() {
    // En pause le curseur ne bouge PAS. Le ticker, lui, continue de tourner
    // (c'est un rAF vide) pour repartir instantanement a la reprise.
    // EXCEPTION : pendant une transition state.playing est faux (l'animation de
    // la scene sortante est arretee), mais la transition CONSOMME du temps sur
    // la piste. Sans cette exception le curseur gelait juste avant la carte de
    // transition et ne la traversait jamais.
    if (!state.playing && !state._tlEnTransition) return;
    const plan = state._tlPlan;
    if (!plan || !plan.totalMs || !plan.scenes.length) return;

    if (!state._tlHorlogeT0) {
      const bloc = plan.scenes[state.sceneIndex ?? 0] || plan.scenes[0];
      _demarrerHorlogeLecture(bloc.startMs);
    }
    let t = state._tlHorlogeBase + (performance.now() - state._tlHorlogeT0);

    const a = H.narration.element();
    if (state._lectureProjet && a && a.src && !a.paused) {
      const ta = a.currentTime * 1000;
      if (Math.abs(ta - t) > TL_SEUIL_RECALAGE_MS) { _demarrerHorlogeLecture(ta); t = ta; }
    }

    // Au tout premier passage, la duree d'une scene sans annotation n'est qu'une
    // estimation : le curseur tapait le bout de la piste et y restait plante
    // (mesure : 552 frames immobiles sur 961, soit la moitie de la video). On
    // laisse la piste APPRENDRE pendant qu'elle joue — la scene en cours
    // s'allonge de ce qui depasse, les suivantes se decalent d'autant.
    const bloc = plan.scenes[state.sceneIndex ?? 0];
    // Une scene ANNOTEE ne s'etire pas : son `to` est une donnee ecrite, pas une
    // estimation. Si le crayon deborde, c'est le crayon qui est en retard, pas la
    // piste qui est trop courte — repousser sa fin retardait d'autant le fondu
    // (_resteAvantFinScene attend bloc.endMs), et l'erreur s'ajoutait de scene en
    // scene : la transition 2->3 partait plus d'une seconde trop tard.
    const _annotee = !!bloc && _sceneAnnotee(bloc.i);
    // Pendant le fondu la scene est FINIE : le temps qui passe appartient a la
    // transition, l'imputer a la scene la ferait grandir a chaque lecture.
    if (bloc && t > bloc.endMs && !state._tlEnTransition && !_annotee) {
      // AUCUNE marge de projection. La scene s'etire exactement jusqu'a t.
      //
      // Une marge gonfle totalMs, or le curseur se place a t / totalMs : il
      // RECULE. Mesure sur la derniere scene, ou la marge avait ete conservee :
      // saut arriere de 99,97 % a 88,13 % de la piste, soit 11,8 %, parfaitement
      // visible. Elle n'existait que pour eviter un curseur colle a 100 % — un
      // defaut de l'epoque ou un seuil de 40 % empechait les durees de converger
      // et laissait des cartes fausses de plusieurs secondes. Ce seuil supprime,
      // le depassement se compte en centaines de ms : un curseur brievement en
      // butee vaut mieux qu'un saut en arriere.
      const marge = 0;
      const rab = t + marge - bloc.endMs;
      const sc = P.scenes()[bloc.i];
      // On l'ecrit DANS la scene et pas seulement dans le plan : _rafraichirPlan()
      // recalcule le plan a partir de _dureeMs, la croissance serait perdue au
      // premier redessin.
      // On ne PERSISTE l'apprentissage que pour une scene encore inconnue. Si sa
      // duree est deja mesuree et que ce passage-ci deborde un peu, le plan en
      // memoire s'etire pour que le curseur avance, mais la carte garde sa
      // valeur — sinon chaque lecture la decalait un peu.
      if (sc && !(sc._dureeMs > 0)) sc._dureeProv = Math.round(t + marge - bloc.startMs);
      // `marge` est du decor pour le curseur, pas du temps de scene. Elle ne
      // retarde plus rien : le fondu d'une scene sans annotation part au dernier
      // trait, et _recalerFinScene() remet la carte sur la mesure juste apres.
      bloc.dureeMs += rab; bloc.endMs += rab;
      plan.scenes.forEach(b => { if (b.i > bloc.i) { b.startMs += rab; b.endMs += rab; } });
      plan.projetMs += rab;
      plan.totalMs = Math.max(plan.projetMs, plan.audioMs, 1);
      // On ne TOUCHE PAS aux cartes pendant la lecture. Le plan grandit en
      // memoire — c'est ce qui permet au curseur de continuer d'avancer — mais
      // des cartes qui se redimensionnent sous les yeux du spectateur donnent
      // l'impression que la piste est instable. Elles sont redessinees une seule
      // fois, a l'arret, avec les durees mesurees.
      // Consequence assumee au PREMIER passage seulement : le curseur peut se
      // decaler des bords de carte, puisque les cartes gardent l'ancienne
      // echelle. Des le second passage les durees sont connues et tout coincide.
    }

    H.onPlayhead(Math.min(t, plan.totalMs) / plan.totalMs);
  }

  /**
   * Amene le projet a l'instant tMs : bonne scene a l'ecran, image devoilee a
   * proportion, voix calee au meme endroit.
   * ponytail: le devoilement est un balayage haut-bas de l'image, pas la frame
   * exacte du style choisi — le moteur ne sait pas rendre un instant donne sans
   * rejouer la scene. Suffisant pour se reperer ; a remplacer le jour ou le
   * moteur expose un rendu a t.
   */

  function _enchainerScene() {
    // La garde defensive d'origine testait `typeof _scenes === 'function'`.
    // En portant, le nom a disparu au profit de P.scenes() : la garde restait
    // vraie sur un identifiant mort, donc toujours fausse, et la liste des
    // scenes arrivait VIDE — la lecture s'arretait a la premiere scene sans
    // qu'aucun fondu ne parte. P.scenes() est contractuel, il n'a pas a etre
    // garde.
    const l = P.scenes();
    const i = state.sceneIndex ?? 0;

    // Duree REELLE de la scene qui vient de se jouer. Aucun style de dessin n'a
    // de duree theorique (elle depend de l'image, du style et de la vitesse) :
    // la seule source fiable est la mesure, et c'est elle qui donne l'echelle
    // de la timeline.
    if (l[i] && state._tlDebutScene && !state._tlMesureFaussee) {
      delete l[i]._dureeProv;
      // La carte decrit LE passage qu'on vient de regarder, toujours.
      //
      // Un seuil de 40 % filtrait autrefois le bruit de mesure (deux lectures du
      // meme dessin varient de ~16 %) pour eviter que les cartes sautillent a
      // chaque "Tout lire". Mais sous le seuil la carte ne convergeait JAMAIS :
      // mesure 2617 ms contre carte 2332 ms, ecart de 12 %, garde tel quel. Le
      // curseur avance en temps reel, lui — les 285 ms d'ecart etaient donc
      // structurels, et se cumulaient de scene en scene (589 ms apres deux).
      // Entre une carte stable et une carte vraie, c'est la vraie qu'on garde :
      // les cartes ne sont plus redessinees qu'aux transitions (_recalerFinScene),
      // donc rien ne bouge sous les yeux du spectateur pendant une scene.
      l[i]._dureeMs = Math.round(performance.now() - state._tlDebutScene);
    }
    if (l[i]) {
      state._tlDebutScene = 0;
      // pas de H.onAutosave() ici : la sauvegarde se fait a la fin de la
      // lecture, sinon on paie la serialisation des images entre deux scenes
    }
    if (!state._lectureProjet || l.length < 2 || i >= l.length - 1) {
      const finDeLecture = state._lectureProjet;
      state._lectureProjet = false;
      state._tlEnTransition = false;
      // Les scenes enchainees ont ete jouees en mode silencieux : l'UI d'edition
      // pointe encore sur la scene de depart, il faut la resynchroniser.
      if (finDeLecture) {
        H.narration.stop();
      
        H.onRafraichir();
      
        H.onPlayhead(-1);
        H.onBoutonLecture();
        H.onAutosave();   // les durees mesurees, une fois la lecture finie
      }
      return false;
    }
    const t   = l[i].transition || {};
    const nom = t.transitionAfter || 'fade';
    const ms  = (nom === 'none' || nom === 'cut') ? 0 : (t.transitionMs ?? 0);
    // couper la boucle rAF en cours : E.demarrer() en relance une, deux boucles
    // simultanees feraient tourner l'animation a double vitesse.
    state.playing = false;
    cancelAnimationFrame(state.animFrame);
    // A partir d'ici plus rien ne se dessine, mais l'horloge de la piste doit
    // continuer : l'attente de fin de carte PUIS le fondu occupent du temps
    // reel, le curseur doit les traverser.
    state._tlEnTransition = true;

    // Le crayon s'arrete SOUVENT avant la fin de la carte : la fenetre d'une
    // scene va jusqu'au `to` de sa derniere region, pas jusqu'au dernier trait.
    // Declencher le fondu ici faisait arriver la transition trop tot, alors que
    // le curseur etait encore au milieu de la carte. On laisse donc le dessin
    // acheve a l'ecran le temps qui lui reste, puis on fond.
    const pendant = () => {
      // Fond de la scene entrante, sans une seule trace : c'est vers LUI que
      // la scene sortante se fond.
      P.choisir(i + 1, true);
      state.bgCanvas = null;
      E.fillBg(E.ctxPrincipal);
      if (E.ctxHand) E.ctxHand.clearRect(0, 0, state.canvasW, state.canvasH);
    };
    // La transition a consomme son propre temps : la scene entrante demarre au
    // debut de sa fenetre, entiere, une fois le fondu acheve.
    const apres = () => E.demarrer();

    // ponytail: toutes les transitions non-cut sont un fondu CSS sur le wrapper
    // (slides comprises). Le compositing par type de transition existe cote
    // backend ; ici c'est une preview, le fondu suffit.
    // Attendre jusqu'a bloc.endMs : la duree du dessin DOIT etre exactement
    // from-to de l'annotation, donc la transition doit se lancer a "to".
    const lancer = () => E.transitionCanvas(ms, i, pendant, apres);
    // Scene SANS annotation : sa carte n'est qu'une estimation, il n'y a aucune
    // fin ecrite a attendre. Le fondu part au dernier trait et c'est la CARTE qui
    // se recale sur le dessin, pas l'inverse.
    const reste = _sceneAnnotee(i) ? _resteAvantFinScene(i) : (_recalerFinScene(), 0);
    // L'attente de fin de carte doit etre ANNULABLE. Sans reference, un stop ou
    // un changement de scene pendant l'attente laissait le timer courir, et
    // lancer() declenchait une transition sur un etat devenu faux — la scene
    // entrante etait deja remplacee.
    _annulerAttenteTransition();
    if (reste > 0) {
      _attenteTransition = setTimeout(() => { _attenteTransition = 0; lancer(); }, reste);
    } else {
      lancer();
    }
    return true;
  }

  /** Vrai si la scene i porte des regions, donc des bornes from/to qui font foi. */

  function _scrubVers(tMs) {
    const plan = state._tlPlan || _planTimeline();
    if (!plan.scenes.length) return;
    const t = Math.max(0, Math.min(plan.totalMs, tMs));
    let bloc = plan.scenes[0];
    for (const b of plan.scenes) if (t >= b.startMs) bloc = b;

    if ((state.sceneIndex ?? 0) !== bloc.i) P.choisir(bloc.i);
    const ratio = bloc.dureeMs ? Math.min(1, (t - bloc.startMs) / bloc.dureeMs) : 1;

    const layer = P.sceneLayer(bloc.sc);
    state.bgCanvas = null;
    E.fillBg(E.ctxPrincipal);
    if (layer && layer.img) {
      const src = layer.img;
      const hNat = (src.naturalHeight || src.height) * ratio;
      if (hNat > 0) {
        E.ctxPrincipal.save();
        E.ctxPrincipal.globalAlpha = layer.opacity ?? 1;
        E.ctxPrincipal.drawImage(src, 0, 0, src.naturalWidth || src.width, hNat,
                                layer.x, layer.y, layer.w, layer.h * ratio);
        E.ctxPrincipal.restore();
      }
    }
    if (E.ctxHand) E.ctxHand.clearRect(0, 0, state.canvasW, state.canvasH);

    // element() peut renvoyer null : c'est ce que fait le hook par defaut, et
    // _majTeteLectureHorloge le teste deja. Ici l'oubli jetait au scrub des que
    // l'hote ne fournissait pas d'element audio.
    const a = H.narration.element();
    const narr = P.courant().narration;
    if (a && narr && narr.audioUrl) {
      if (a.src !== narr.audioUrl) a.src = narr.audioUrl;
      a.pause();
      try { a.currentTime = t / 1000; } catch (e) {}
    }
    _demarrerHorlogeLecture(t);
    H.onPlayhead(t / plan.totalMs);
    E.setProgress(ratio);
  }

  /**
   * Regler une region a la souris : la tirer par le milieu la deplace dans le
   * temps, par un bord elle change de duree. Les millisecondes se saisissaient
   * jusqu'ici a l'aveugle dans l'inspecteur d'annotation, sans voir ou la region
   * tombe par rapport a la voix.
   */

  function lireProjetEntier() {
    // Le plan doit exister AVANT la premiere frame : _majTeteLectureHorloge()
    // sort immediatement s'il manque, et la tete ne bouge jamais. Dans
    // app/index.html renderTimeline() en garantissait un en permanence ; ici le
    // module ne peut pas dependre de l'hote pour ca.
    if (!state._tlPlan) _rafraichirPlan();
    const l = P.scenes();
    if (l.length < 2) { genererSceneCourante(); return; }
    state._lectureProjet = true;
    P.choisir(0);
    _demarrerHorlogeLecture(0);   // une seule horloge pour tout le projet
    _demarrerTickerCurseur();
    E.demarrer();
    H.onBoutonLecture();
  }

  function basculerLectureProjet() {
    if (state._lectureProjet) { E.basculerPause(); return; }
    lireProjetEntier();
  }

  /** Rejoue le projet entier : scene 1 puis les suivantes, transitions comprises. */

  function genererSceneCourante() {
    state._lectureProjet = false;
    _arreterHorlogeLecture();   // reancree sur la scene a la premiere frame
    E.demarrer();
  }

  /** Le bouton de la piste : lance la lecture, ou met en pause si elle tourne. */


  /**
   * Recalcule le plan ET le range dans l'etat, puis previent l'hote.
   *
   * Dans app/index.html cette affectation vivait au milieu de renderTimeline(),
   * une fonction de RENDU : `state._tlPlan = plan`. En sortant le rendu vers
   * React, elle serait passee a la trappe — et sans plan en etat, la tete de
   * lecture sort immediatement de _majTeteLectureHorloge() et ne bouge jamais.
   * Le plan est de l'etat, pas du DOM : il se range ici.
   */
  function _rafraichirPlan() {
    state._tlPlan = _planTimeline();
    H.onPlan(state._tlPlan);
    // La tete se replace TOUT DE SUITE sur la nouvelle echelle.
    //
    // Sans ca elle garde jusqu'a la frame suivante la position calculee avec
    // l'ancien totalMs, pendant que les cartes, elles, ont deja bouge : au
    // premier fondu d'un projet neuf, ou la carte passe de l'estimation a la
    // mesure, l'ecart atteignait 3,3 % de la piste. app/index.html avait le
    // meme retard d'une frame — c'est un ecart corrige, pas un ecart introduit.
    if (state._tlHorlogeT0 && state._tlPlan.totalMs) {
      const t = state._tlHorlogeBase + (performance.now() - state._tlHorlogeT0);
      H.onPlayhead(Math.min(t, state._tlPlan.totalMs) / state._tlPlan.totalMs);
    }
    return state._tlPlan;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Surface publique
  // ═══════════════════════════════════════════════════════════════════════

  return {
    state,
    plan: _rafraichirPlan,
    planCalcule: _planTimeline,
    lire: lireProjetEntier,
    basculer: basculerLectureProjet,
    sceneSeule: genererSceneCourante,
    scrub: _scrubVers,
    formater: _tlFmt,
    dureeScene: _dureeScene,
    sceneAnnotee: _sceneAnnotee,
    bornesRegion: _bornesRegion,
    ecrireBornesRegion: _ecrireBornesRegion,
    // pilotes par le moteur via ses hooks
    enchainerScene: _enchainerScene,
    tickCurseur: _majTeteLectureHorloge,
    demarrerTicker: _demarrerTickerCurseur,
    arreterTicker: _arreterTickerCurseur,
    demarrerHorloge: _demarrerHorlogeLecture,
    arreterHorloge: _arreterHorlogeLecture,
    /** La piste connait la duree reelle de la voix une fois l'onde decodee. */
    poserDureeAudio(url, ms) { _tlPicsUrl = url; _tlPicsMs = ms; },
  };
}

module.exports = { createTimeline, TL_DUREE_DEFAUT, TL_SEUIL_RECALAGE_MS };
