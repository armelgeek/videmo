"use client";

import { Fragment, memo } from "react";
import { useStoryboardStore } from "@/lib/storyboard/store";

const INK = "#1a2340";
const STYLES = [
  { accent: "#e91e8c", variant: "fill" },
  { accent: "#00d8ff", variant: "underline" },
] as const;

/** Splits on whitespace only, so punctuation stays attached to its word. */
function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** The active scene's narration, one numbered segment per beat. */
function ScriptSegmentsCardImpl({ className }: { className?: string }) {
  const panel = useStoryboardStore((s) => s.storyboardPanels[s.activeClipIndex]);
  if (!panel) return null;

  const segments = (panel.beats?.length
    ? panel.beats.map((beat) => beat.narration)
    : [panel.narration ?? ""]
  ).filter((text) => text.trim());

  if (segments.length === 0) return null;

  return (
    <div
      className={className}
      style={{
        background: "#ffffff",
        border: `1px solid ${INK}`,
        borderRadius: 12,
        padding: "20px 24px",
        color: INK,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 15,
        lineHeight: 2,
      }}
    >
      {segments.map((text, segmentIdx) => {
        const { accent, variant } = STYLES[segmentIdx % STYLES.length];
        const list = words(text);
        return (
          <Fragment key={segmentIdx}>
            {list.map((word, wordIdx) => (
              <Fragment key={wordIdx}>
                <span style={{ whiteSpace: wordIdx === 0 ? "nowrap" : undefined }}>
                  {wordIdx === 0 && (
                    <span
                      style={{
                        background: accent,
                        color: "#ffffff",
                        fontSize: 11,
                        padding: "1px 4px",
                        borderRadius: 3,
                        marginRight: 2,
                        verticalAlign: "middle",
                      }}
                    >
                      #{segmentIdx + 1}
                    </span>
                  )}
                  <span
                    style={
                      variant === "fill"
                        ? { background: accent, color: "#ffffff", padding: "1px 3px" }
                        : { fontWeight: 700, borderBottom: `3px solid ${accent}` }
                    }
                  >
                    {word}
                  </span>
                  {wordIdx === list.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 3,
                        height: "1.3em",
                        marginLeft: 3,
                        background: accent,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </span>{" "}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

export const ScriptSegmentsCard = memo(ScriptSegmentsCardImpl);
