"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ORGANIZATION_CHANGED_EVENT } from "@/lib/app-shell/organization-events";

interface ListResult<T> {
  success: boolean;
  data?: T[];
  canWrite?: boolean;
  /** Which row the organization starts from, for collections that have one. */
  defaultKey?: string | null;
  error?: string;
}

interface DeleteResult {
  success: boolean;
  error?: string;
}

interface UseManagedCollectionOptions<T> {
  fetchList: () => Promise<ListResult<T>>;
  deleteItem: (rowId: string) => Promise<DeleteResult>;
  isBuiltIn: (key: string) => boolean;
  getItemId: (item: T) => string;
  getItemLabel: (item: T) => string;
  getItemRowId: (item: T) => string | null;
  errorMessage?: string;
}

export function useManagedCollection<T>({
  fetchList,
  deleteItem,
  isBuiltIn,
  getItemId,
  getItemLabel,
  getItemRowId,
  errorMessage = "Items could not be loaded.",
}: UseManagedCollectionOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [defaultKey, setDefaultKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchList();
    if (!result.success || !result.data) {
      toast.error(result.error ?? errorMessage);
      setIsLoading(false);
      return;
    }
    setItems(result.data);
    setCanWrite(Boolean(result.canWrite));
    setDefaultKey(result.defaultKey ?? null);
    setIsLoading(false);
  }, [fetchList, errorMessage]);

  useEffect(() => {
    load();
    const onChange = () => {
      setIsLoading(true);
      load();
    };
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
  }, [load]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const rowId = getItemRowId(pendingDelete);
    if (!rowId) return;

    setIsDeleting(true);
    try {
      const result = await deleteItem(rowId);
      if (!result.success) {
        toast.error(result.error ?? "Could not delete the item");
        return;
      }
      const id = getItemId(pendingDelete);
      const label = getItemLabel(pendingDelete);
      toast.success(
        isBuiltIn(id)
          ? `Reverted to the shipped “${label}”`
          : `“${label}” deleted`,
      );
      setPendingDelete(null);
      await load();
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    items,
    canWrite,
    defaultKey,
    isLoading,
    pendingDelete,
    setPendingDelete,
    isDeleting,
    confirmDelete,
    load,
  };
}
