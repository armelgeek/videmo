import { z } from "zod";
import { SHOWCASE_SECTOR_IDS } from "./sectors";

const url = z.string().trim().url("Must be a full URL (https://…)");

export const ShowcaseInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  sector: z.enum(SHOWCASE_SECTOR_IDS as [string, ...string[]], { message: "Pick a sector" }),
  customer: z.string().trim().max(120).optional().or(z.literal("")),
  videoUrl: url,
  posterUrl: url.optional().or(z.literal("")),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
  durationSec: z.coerce.number().int().positive().max(3600).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});

export type ShowcaseInput = z.infer<typeof ShowcaseInputSchema>;

export interface ShowcaseVideoDto {
  id: string;
  title: string;
  description: string | null;
  sector: string;
  customer: string | null;
  videoUrl: string;
  posterUrl: string | null;
  aspectRatio: string;
  durationSec: number | null;
  sortOrder: number;
  published: boolean;
  updatedAt: Date;
}
