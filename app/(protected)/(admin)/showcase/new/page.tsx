import { requirePermission } from '@/lib/auth-helpers';
import { ShowcaseForm } from '@/components/organisms/showcase/showcase-form';

export default async function NewShowcasePage() {
  await requirePermission('showcase', 'create');
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Add a showcase video</h1>
      <ShowcaseForm />
    </div>
  );
}
