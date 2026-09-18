"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ShowcaseInputSchema, type ShowcaseVideoDto } from "@/lib/showcase/schema";
import type { CrudListOptions, CrudListResponse } from "@/types/crud";

type Result<T> = { success: true; data: T } | { success: false; error: string };

function toData(raw: unknown) {
  const input = ShowcaseInputSchema.parse(raw);
  return {
    ...input,
    description: input.description || null,
    customer: input.customer || null,
    posterUrl: input.posterUrl || null,
    durationSec: input.durationSec ?? null,
  };
}

function failure(error: unknown): { success: false; error: string } {
  if (error && typeof error === "object" && "issues" in error) {
    const issue = (error as { issues: { message: string }[] }).issues[0];
    return { success: false, error: issue?.message ?? "Invalid data" };
  }
  console.error("[showcase]", error);
  return { success: false, error: "Something went wrong" };
}

export async function listShowcaseCrud(options: CrudListOptions): Promise<CrudListResponse<ShowcaseVideoDto>> {
  await requirePermission("showcase", "read");
  const page = options.page || 1;
  const pageSize = options.pageSize || 10;
  const title = String(options.filters?.title ?? "").trim();
  const sector = String(options.filters?.sector ?? "all");
  const published = String(options.filters?.published ?? "all");

  const where = {
    ...(title && { title: { contains: title, mode: "insensitive" as const } }),
    ...(sector !== "all" && { sector }),
    ...(published !== "all" && { published: published === "true" }),
  };

  const [data, total] = await Promise.all([
    prisma.showcaseVideo.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.showcaseVideo.count({ where }),
  ]);

  return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getShowcaseVideo(id: string): Promise<Result<ShowcaseVideoDto>> {
  await requirePermission("showcase", "read");
  const video = await prisma.showcaseVideo.findUnique({ where: { id } });
  return video ? { success: true, data: video } : { success: false, error: "Video not found" };
}

export async function createShowcaseVideo(raw: unknown): Promise<Result<ShowcaseVideoDto>> {
  await requirePermission("showcase", "create");
  try {
    const video = await prisma.showcaseVideo.create({ data: toData(raw) });
    revalidatePath("/");
    return { success: true, data: video };
  } catch (error) {
    return failure(error);
  }
}

export async function updateShowcaseVideo(id: string, raw: unknown): Promise<Result<ShowcaseVideoDto>> {
  await requirePermission("showcase", "update");
  try {
    const video = await prisma.showcaseVideo.update({ where: { id }, data: toData(raw) });
    revalidatePath("/");
    return { success: true, data: video };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteShowcaseVideo(id: string): Promise<Result<null>> {
  await requirePermission("showcase", "delete");
  try {
    await prisma.showcaseVideo.delete({ where: { id } });
    revalidatePath("/");
    return { success: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
