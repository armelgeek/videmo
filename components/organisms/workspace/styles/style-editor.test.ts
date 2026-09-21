import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { builtInVisualStyle } from "@/lib/storyboard/visual-styles/built-in";

const push = vi.fn();
const refresh = vi.fn();
const saveVisualStyle = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/actions/visual-styles/save-visual-style", () => ({ saveVisualStyle }));

const { StyleEditor } = await import("./style-editor");

const mount = (over: { initial?: ReturnType<typeof builtInVisualStyle> | null; isOverride?: boolean } = {}) =>
  render(createElement(StyleEditor, { initial: over.initial ?? null, isOverride: over.isOverride ?? false }));

const save = () => screen.getByRole("button", { name: /Save style/ }) as HTMLButtonElement;
const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StyleEditor", () => {
  it("derives the key from the name while creating", () => {
    mount();
    type(/^Name$/, "Blue Pen");
    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("blue-pen");
  });

  it("freezes the key of a saved style", () => {
    // Projects are stored against it: renaming would orphan them.
    mount({ initial: builtInVisualStyle("doodle"), isOverride: true });
    expect((screen.getByLabelText("Key") as HTMLInputElement).disabled).toBe(true);
  });

  it("warns as soon as the art direction asks for something the pen cannot trace", () => {
    mount();
    type(/^Name$/, "Paint");
    type(/Art direction/, "Soft watercolor washes on paper");

    expect(screen.getByRole("alert").textContent).toContain("watercolor");
    expect(save().disabled).toBe(true);
  });

  it("clears the warning once the term is removed", () => {
    mount();
    type(/^Name$/, "Paint");
    type(/Art direction/, "Soft watercolor washes");
    type(/Art direction/, "Soft rounded pen strokes");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(save().disabled).toBe(false);
  });

  it("saves the style and goes back to the list", async () => {
    saveVisualStyle.mockResolvedValue({ success: true });
    mount();
    type(/^Name$/, "Blue Pen");
    type(/One-line description/, "Thin and calm.");
    type(/Art direction/, "Thin precise pen drawing, clean shapes");
    fireEvent.click(save());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/workspace/brand/styles"));
    expect(saveVisualStyle).toHaveBeenCalledWith(
      expect.objectContaining({ key: "blue-pen", accentColors: ["blue"], labels: "key-subjects" }),
    );
  });

  it("stays on the page when the save is refused", async () => {
    saveVisualStyle.mockResolvedValue({ success: false, error: "nope" });
    mount();
    type(/^Name$/, "Blue Pen");
    type(/Art direction/, "Thin precise pen drawing, clean shapes");
    fireEvent.click(save());

    await waitFor(() => expect(saveVisualStyle).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
