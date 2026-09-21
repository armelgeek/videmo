"use client";

import { toast } from "sonner";
import { listManagedVisualStyles } from "@/actions/visual-styles/list-visual-styles";
import { setDefaultVisualStyle } from "@/actions/visual-styles/set-default-visual-style";
import { deleteVisualStyle } from "@/actions/visual-styles/delete-visual-style";
import { isBuiltInVisualStyle } from "@/lib/storyboard/visual-styles/built-in";
import type { ManagedVisualStyle } from "@/lib/storyboard/visual-styles/types";
import { useManagedCollection } from "@/hooks/use-managed-collection";
import { StylePreview } from "@/components/molecules/workspace/style-preview";
import { BrandTabs } from "./brand-tabs";
import { CollectionScreen } from "./collection-screen";

/**
 * The organization's visual styles.
 *
 * Styles are data: this screen is what makes them editable without a deploy. A
 * shipped style is never written to — customizing one saves the organization's
 * own copy under the same key, which then wins at resolution.
 */
export function StylesView() {
  const collection = useManagedCollection<ManagedVisualStyle>({
    fetchList: listManagedVisualStyles,
    deleteItem: deleteVisualStyle,
    isBuiltIn: isBuiltInVisualStyle,
    getItemId: (entry) => entry.style.id,
    getItemLabel: (entry) => entry.style.label,
    getItemRowId: (entry) => entry.rowId,
    errorMessage: "Visual styles could not be loaded.",
  });

  const handleSetDefault = async (key: string) => {
    const result = await setDefaultVisualStyle(key);
    if (!result.success) {
      toast.error(result.error ?? "Could not set the default style");
      return;
    }
    toast.success("New projects will be drawn in this style");
    await collection.load();
  };

  return (
    <CollectionScreen
      tabs={<BrandTabs />}
      title="Visual styles"
      nudge="give your videos their own hand"
      lede="How the drawings look. Write your own, or start from one of ours."
      noun="style"
      newHref="/workspace/brand/styles/new"
      editHref={(id) => `/workspace/brand/styles/${id}/edit`}
      collection={collection}
      defaultId={collection.defaultKey}
      onSetDefault={handleSetDefault}
      isBuiltIn={isBuiltInVisualStyle}
      toEntry={({ style, rowId, isOwn }) => ({
        id: style.id,
        label: style.label,
        hint: style.hint,
        rowId,
        isOwn,
      })}
      media={({ style }) => <StylePreview style={style} />}
      readOnlyNote="Writing styles is for the owners and admins of an organization — one row is what every project here generates against. You can use the ones shipped with the product."
      revertDescription="Your changes are dropped and the shipped style comes back. Projects keep working."
      deleteDescription="Projects already using this style keep their images, and fall back to the default the next time they generate."
    />
  );
}
