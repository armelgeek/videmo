import { prisma } from "@/lib/prisma";
import type { ShowcaseVideoDto } from "./schema";

export function listPublishedShowcase(): Promise<ShowcaseVideoDto[]> {
  return prisma.showcaseVideo.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 48,
  });
}
