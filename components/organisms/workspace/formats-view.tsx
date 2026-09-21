"use client";

import { listManagedFormats } from "@/actions/video-formats/list-managed-formats";
import { deleteVideoFormat } from "@/actions/video-formats/delete-video-format";
import { isBuiltInFormat } from "@/lib/storyboard/formats";
import type { ManagedFormat } from "@/lib/storyboard/formats";
import { useManagedCollection } from "@/hooks/use-managed-collection";
import { BrandTabs } from "./brand-tabs";
import { FormatStrip } from "@/components/molecules/workspace/format-strip";
import { Chip, CollectionScreen } from "./collection-screen";

/**
 * The organization's video types.
 *
 * Formats are data: this screen is what makes them editable without a deploy.
 * A shipped format is never written to — customizing one saves the
 * organization's own copy under the same key, which then wins at resolution.
 */
export function FormatsView() {
  const collection = useManagedCollection<ManagedFormat>({
    fetchList: listManagedFormats,
    deleteItem: deleteVideoFormat,
    isBuiltIn: isBuiltInFormat,
    getItemId: (entry) => entry.format.id,
    getItemLabel: (entry) => entry.format.label,
    getItemRowId: (entry) => entry.rowId,
    errorMessage: "Video formats could not be loaded.",
  });

  return (
    <CollectionScreen
      tabs={<BrandTabs />}
      title="Video formats"
      nudge="write your own kind of video"
      lede="The types of video your scripts are written against. Write your own, or start from one of ours."
      noun="format"
      newHref="/workspace/brand/formats/new"
      editHref={(id) => `/workspace/brand/formats/${id}/edit`}
      collection={collection}
      isBuiltIn={isBuiltInFormat}
      toEntry={({ format, rowId, isOwn }) => ({
        id: format.id,
        label: format.label,
        hint: format.hint,
        rowId,
        isOwn,
      })}
      media={({ format }) => <FormatStrip format={format} />}
      facts={({ format }) => (
        <>
          <Chip>{format.script.paragraphs} scenes</Chip>
          <Chip>{format.script.defaultTone}</Chip>
          {format.usesCharacter && <Chip>a character</Chip>}
        </>
      )}
      readOnlyNote="Writing formats is for the owners and admins of an organization — one row is what every project here generates against. You can use the ones shipped with the product."
      revertDescription="Your changes are dropped and the shipped format comes back. Projects keep working."
      deleteDescription="Projects already written against this format keep their script, and fall back to the default the next time they generate."
    />
  );
}
