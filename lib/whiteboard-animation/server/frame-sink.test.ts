import { describe, expect, it } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createFrameSink } = require("./frame-sink");

const buf = (n: string) => Buffer.from(n);

function harness() {
  const written: string[] = [];
  const sink = createFrameSink({
    write: (b: Buffer) => written.push(b.toString()),
    makeTransitionFrames: (a: Buffer, b: Buffer, n: number) =>
      Array.from({ length: n }, (_, i) => buf(`T(${a}->${b})${i}`)),
  });
  return { sink, written };
}

describe("createFrameSink", () => {
  it("ecrit une scene unique dans l'ordre", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.sceneFrame(buf("a1"), 0);
    sink.endScene(0, 0);
    sink.finish();
    expect(written).toEqual(["a0", "a1"]);
  });

  it("insere le fondu entre les deux scenes", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.sceneFrame(buf("a1"), 0);
    sink.endScene(0, 2);
    sink.sceneFrame(buf("b0"), 1);
    sink.sceneFrame(buf("b1"), 1);
    sink.endScene(1, 0);
    sink.finish();
    expect(written).toEqual(["a0", "a1", "T(a1->b0)0", "T(a1->b0)1", "b0", "b1"]);
  });

  it("enchaine sans fondu quand la transition est nulle", () => {
    const { sink, written } = harness();
    sink.sceneFrame(buf("a0"), 0);
    sink.endScene(0, 0);
    sink.sceneFrame(buf("b0"), 1);
    sink.endScene(1, 0);
    sink.finish();
    expect(written).toEqual(["a0", "b0"]);
  });

  it("ne retient jamais plus de deux frames", () => {
    const { sink } = harness();
    for (let i = 0; i < 500; i++) sink.sceneFrame(buf(`a${i}`), 0);
    sink.endScene(0, 3);
    for (let i = 0; i < 500; i++) sink.sceneFrame(buf(`b${i}`), 1);
    expect(sink.heldFrames()).toBeLessThanOrEqual(2);
    sink.endScene(1, 0);
    sink.finish();
  });
});
