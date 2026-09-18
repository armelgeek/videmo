'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { CrudPage } from '@/components/organisms/crud';
import type { CrudColumn, CrudFilterConfig } from '@/types/crud';
import { useCrudList } from '@/hooks/use-crud-list';
import { useCrudDelete } from '@/hooks/use-crud-delete';
import { deleteShowcaseVideo, listShowcaseCrud } from '@/actions/showcase/manage-showcase';
import type { ShowcaseVideoDto } from '@/lib/showcase/schema';
import { SHOWCASE_SECTORS, SHOWCASE_SECTOR_IDS, sectorLabel } from '@/lib/showcase/sectors';

const columns: CrudColumn<ShowcaseVideoDto>[] = [
  { key: 'title', label: 'Title', width: '280px' },
  { key: 'sector', label: 'Sector', render: (value) => sectorLabel(String(value)) },
  { key: 'aspectRatio', label: 'Format' },
  {
    key: 'published',
    label: 'Status',
    render: (value) => <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Published' : 'Draft'}</Badge>,
  },
  { key: 'sortOrder', label: 'Order' },
];

const filters: CrudFilterConfig[] = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'Search by title' },
  {
    key: 'sector',
    label: 'Sector',
    type: 'select',
    options: [{ label: 'All', value: 'all' }, ...SHOWCASE_SECTOR_IDS.map((id) => ({ label: SHOWCASE_SECTORS[id], value: id }))],
  },
  {
    key: 'published',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'All', value: 'all' },
      { label: 'Published', value: 'true' },
      { label: 'Draft', value: 'false' },
    ],
  },
];

export default function ShowcasePage() {
  const router = useRouter();
  const list = useCrudList({ fetchFn: listShowcaseCrud });
  const del = useCrudDelete<ShowcaseVideoDto>({
    onDelete: async (video) => {
      const result = await deleteShowcaseVideo(video.id);
      if (!result.success) throw new Error(result.error);
      await list.refresh();
    },
  });

  return (
    <CrudPage<ShowcaseVideoDto>
      title="Showcase videos"
      description="Real customer videos shown on the landing page, filterable by sector"
      columns={columns}
      filters={filters}
      data={list.data}
      isLoading={list.isLoading}
      page={list.page}
      itemsPerPage={list.itemsPerPage}
      totalPages={list.totalPages}
      filterValues={list.filters}
      onFilterChange={list.handleFilterChange}
      onResetFilters={list.resetFilters}
      onPageChange={list.handlePageChange}
      onItemsPerPageChange={list.handleItemsPerPageChange}
      onEdit={(video) => router.push(`/showcase/${video.id}`)}
      onDelete={del.handleDeleteClick}
      onNew={() => router.push('/showcase/new')}
      deleteDialogOpen={del.deleteDialogOpen}
      deletingItem={del.deletingItem}
      isDeleting={del.isDeleting}
      onConfirmDelete={del.handleConfirmDelete}
      onCancelDelete={del.handleCancelDelete}
    />
  );
}
