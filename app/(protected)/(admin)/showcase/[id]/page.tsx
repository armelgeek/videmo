import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth-helpers';
import { getShowcaseVideo } from '@/actions/showcase/manage-showcase';
import { ShowcaseForm } from '@/components/organisms/showcase/showcase-form';

export default async function EditShowcasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('showcase', 'update');
  const result = await getShowcaseVideo((await params).id);
  if (!result.success) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Edit showcase video</h1>
      <ShowcaseForm video={result.data} />
    </div>
  );
}
