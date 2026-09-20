import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { BUILT_IN_VISUAL_STYLES } from "../lib/storyboard/visual-styles/built-in";

/**
 * Inserts the shipped visual styles as rows with no organization, which is
 * what makes them visible to everyone.
 *
 * Idempotent, and safe to re-run after editing a definition in code: it
 * matches on `key` and updates in place, so an organization that overrode a
 * style keeps its own row untouched.
 */
async function main() {
  let created = 0;
  let updated = 0;

  for (const style of BUILT_IN_VISUAL_STYLES) {
    const row = {
      key: style.id,
      label: style.label,
      hint: style.hint,
      artDirection: style.artDirection,
      accentColors: style.accentColors as Prisma.InputJsonValue,
      vocabulary: style.vocabulary as Prisma.InputJsonValue,
      labels: style.labels,
      isBuiltIn: true,
    };

    const existing = await prisma.visualStyle.findFirst({
      where: { key: style.id, organizationId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.visualStyle.update({ where: { id: existing.id }, data: { ...row, deletedAt: null } });
      updated += 1;
    } else {
      await prisma.visualStyle.create({ data: { ...row, organizationId: null } });
      created += 1;
    }
  }

  console.log(`Visual styles seeded: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error("Visual style seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
