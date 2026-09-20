import "dotenv/config";
import { prisma } from "../lib/prisma";
import { BUILT_IN_WHITEBOARD_STYLES } from "../lib/storyboard/whiteboard-styles/built-in";

/**
 * Inserts the shipped whiteboard styles as rows with no organization, which is
 * what makes them visible to everyone.
 *
 * Idempotent, and safe to re-run after editing a definition in code: it
 * matches on `key` and updates in place, so an organization that overrode a
 * style keeps its own row untouched.
 */
async function main() {
  let created = 0;
  let updated = 0;

  for (const style of BUILT_IN_WHITEBOARD_STYLES) {
    const row = {
      key: style.id,
      label: style.label,
      hint: style.hint,
      animStyle: style.animStyle,
      handStyle: style.handStyle,
      isBuiltIn: true,
    };

    const existing = await prisma.whiteboardStyle.findFirst({
      where: { key: style.id, organizationId: null },
      select: { id: true },
    });

    if (existing) {
      await prisma.whiteboardStyle.update({ where: { id: existing.id }, data: { ...row, deletedAt: null } });
      updated += 1;
    } else {
      await prisma.whiteboardStyle.create({ data: { ...row, organizationId: null } });
      created += 1;
    }
  }

  console.log(`Whiteboard styles seeded: ${created} created, ${updated} updated.`);
}

main()
  .catch((error) => {
    console.error("Whiteboard style seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
