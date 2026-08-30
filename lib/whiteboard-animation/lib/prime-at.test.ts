import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Animation = require("./Animation");

/** Un moteur reduit a ce que primeAt touche. */
function engine(elapsedMs = 0) {
  const a = Object.create(Animation.prototype);
  a.annotationManager = { elapsedMs };
  a.state = { _lastAnnotationIdx: 2, _annotationChanged: true };
  a._finished = true;
  a._regionDone = true;
  a._paceCarry = { "10:1": { frame: 5, emitted: 5, start: 0.2 } };
  a._frames = 42;
  a._regionElapsed = 500;
  a._regionDuration = 1000;
  return a;
}

describe("primeAt", () => {
  it("place l'horloge sur la borne demandee", () => {
    const a = engine(0);
    a.primeAt(5500);
    expect(a.annotationManager.elapsedMs).toBe(5500);
  });

  it("borne a zero une position negative", () => {
    const a = engine(1000);
    a.primeAt(-200);
    expect(a.annotationManager.elapsedMs).toBe(0);
  });

  it("force le prochain tick a re-entrer dans la region", () => {
    // Sans cela _enterRegion n'est pas rappele et le style continue de tracer
    // la region precedente, hors de la fenetre cherchee.
    const a = engine();
    a.primeAt(3000);
    expect(a.state._lastAnnotationIdx).toBeUndefined();
  });

  it("purge la cadence de la region precedente", () => {
    // _paceCarry retient combien de points ont deja ete emis : le garder ferait
    // demarrer la region cherchee au milieu de son trace.
    const a = engine();
    a.primeAt(3000);
    expect(a._paceCarry).toBeNull();
    expect(a._regionElapsed).toBe(0);
    expect(a._regionDuration).toBe(0);
  });

  it("rearme un moteur deja termine", () => {
    const a = engine(99999);
    a.primeAt(1000);
    expect(a._finished).toBe(false);
    expect(a._regionDone).toBe(false);
  });

  it("ne fait rien hors mode annotation", () => {
    const a = Object.create(Animation.prototype);
    a.annotationManager = null;
    expect(() => a.primeAt(1000)).not.toThrow();
  });
});
