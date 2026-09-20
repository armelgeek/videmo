import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { BUILT_IN_FORMATS } from "../lib/storyboard/formats/built-in";

/**
 * Inserts the shipped formats as rows with no organization, which is what
 * makes them visible to everyone.
 *
 * Idempotent, and safe to re-run after editing a definition in code: it
 * matches on `key` and updates in place, so an organization that overrode a
 * format under the same key keeps its own row untouched.
 */
async function main() {
  let created = 0;
  let updated = 0;

  for (const format of BUILT_IN_FORMATS) {
    const row = {
      key: format.id,
      version: format.version,
      label: format.label,
      hint: format.hint,
      family: format.family,
      thumbnailUrl: format.thumbnailUrl || null,
      paragraphs: format.script.paragraphs,
      structure: format.script.structure,
      defaultTone: format.script.defaultTone,
      breakdownRules: format.breakdown.rules,
      visual: format.visual as unknown as Prisma.InputJsonObject,
      // A nullable Json column distinguishes "no value" from the JSON literal
      // `null`; only DbNull clears it.
      character: (format.character ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      isBuiltIn: true,
    };

    const existing = await prisma.videoFormat.findFirst({
      where: { key: format.id, organizationId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.videoFormat.update({
        where: { id: existing.id },
        data: { ...row, deletedAt: null },
      });
      updated += 1;
    } else {
      await prisma.videoFormat.create({ data: { ...row, organizationId: null } });
      created += 1;
    }
  }

  console.log(`Video formats seeded: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error("Video format seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
