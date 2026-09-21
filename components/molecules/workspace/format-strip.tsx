import { cn } from "@/lib/utils";
import type { VideoFormat } from "@/lib/storyboard/formats";

/** As many beats as fit before the card stops being scannable. */
const VISIBLE = 4;

/** "Hook (why care)" reads as "Hook" at this size. */
const short = (movement: string) =>
  movement.replace(/\s*[([].*$/, "").replace(/\s+[-–—]\s+.*$/, "").trim();

/**
 * A format drawn as the running order it produces: its first beats, in order,
 * and how many follow.
 *
 * It replaces the counts a card used to print — "10 paragraphs, 10 movements"
 * says nothing about whether the video hooks, teaches or sells.
 */
export function FormatStrip({ format, className }: { format: VideoFormat; className?: string }) {
  const movements = format.script.structure;
  const shown = movements.slice(0, VISIBLE);
  const rest = movements.length - shown.length;

  if (shown.length === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-white", className)}>
        <p className="font-hand text-sm text-ink/50">no movements yet</p>
      </div>
    );
  }

  return (
    <ol className={cn("flex h-full w-full flex-col justify-center gap-0.5 bg-white px-3 py-2", className)}>
      {shown.map((movement, i) => (
        <li key={`${i}-${movement}`} className="flex items-baseline gap-2">
          <span className="w-4 shrink-0 font-mono text-[9px] text-ink/40">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="truncate font-hand text-[13px] leading-tight text-ink">
            {short(movement)}
          </span>
        </li>
      ))}

      {rest > 0 && (
        <li className="flex items-baseline gap-2">
          <span className="w-4 shrink-0 font-mono text-[9px] text-ink/40">··</span>
          <span className="font-hand text-[13px] leading-tight text-ink/55">
            and {rest} more
          </span>
        </li>
      )}
    </ol>
  );
}
