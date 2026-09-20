# Video formats

A format is the **type of video** a script is written against: how many
paragraphs, which narrative movements, which drawing vocabulary, and — for the
formats that tell a story — which recurring character.

Formats are **data, not code**. They live in the `VideoFormat` table, so an
organization writes its own without a deploy.

## Where things live

| File | Role |
|---|---|
| `types.ts` | The `VideoFormat` shape the prompt builders consume |
| `built-in.ts` | The shipped formats — seed data and fallback, not a registry |
| `brief.ts`, `explainer.ts`, `tutorial.ts`, `story.ts`, `product-demo.ts`, `educational.ts` | One shipped definition each |
| `visual-presets.ts` | Drawing vocabulary, accent colours, labelling policy |
| `repository.ts` | **Server only.** Reads formats from the database |
| `schema.ts` | Zod validation for a format written through the UI |

Prompts are built in `../script-generation.ts`, which now *receives* a format
instead of looking one up.

## Resolution

`listFormatsFor(organizationId)` returns the shipped formats plus the
organization's own. When both define the same `key`, **the organization's row
wins** — that is how a shipped format is overridden without touching it for
anyone else.

If the table is empty the shipped definitions are used, so a fresh install can
generate before anyone has run the seed.

```ts
import { resolveFormat } from '@/lib/storyboard/formats/repository'

const format = await resolveFormat(input.format, viewer.organizationId)
const prompt = buildScriptPrompt(input, format)
```

An unknown key falls back to the default rather than throwing: a project saved
against a format that has since been deleted must still open.

## What a format changes in the output

**In the script prompt** (`buildScriptPrompt`):
- the paragraph target (`script.paragraphs`)
- the narrative movements to cover, in order (`script.structure`)

Without the structure a format only changed the script's *length* — a tutorial
and a story came out reading exactly the same.

**In the breakdown prompt** (`buildBreakdownPrompt`):
- the drawing vocabulary and accent colours (`visual`)
- the labelling policy (`visual.labels`)
- the format's own rules (`breakdown.rules`)
- the recurring character, repeated verbatim in every image prompt (`character`)

## Seeding

```bash
npm run seed:video-formats
```

Idempotent, and safe to re-run after editing a definition in code: it matches
on `key` and updates in place. An organization that overrode a format keeps its
own row untouched.

## Writing a format from the app

```ts
import { saveVideoFormat } from '@/actions/video-formats/save-video-format'

await saveVideoFormat({
  key: 'saas-onboarding',
  label: 'SaaS onboarding',
  hint: 'Walk a new user through first value.',
  family: 'explainer',
  paragraphs: 7,
  structure: ['Welcome', 'First win', 'Core loop', 'Invite the team'],
  defaultTone: 'friendly',
  breakdownRules: ['Show the product UI, never a metaphor'],
  visual: {
    id: 'saas-ui',
    vocabulary: ['ui-elements', 'cursors', 'checkmarks'],
    accentColors: ['indigo', 'teal'],
    labels: 'key-subjects',
    defaultAnimationStyle: 'spotlight',
  },
  character: null,
})
```

Saving under the key of a shipped format creates the organization's own row
with that key, which then wins at resolution.

`deleteVideoFormat(id)` is a soft delete scoped to the organization: deleting
an override brings the shipped format back, and the shipped ones themselves
cannot be removed.

## Adding a shipped format

Only for formats that ship with the product — anything organization-specific
belongs in the database.

1. Add a preset to `visual-presets.ts` if the look is new
2. Create `my-format.ts` exporting a `VideoFormat`
3. Register it in `built-in.ts`
4. `npm run seed:video-formats`

`formats.test.ts` enforces that every shipped format has a structure, breakdown
rules and a visual vocabulary — a format with none would only change the length.
