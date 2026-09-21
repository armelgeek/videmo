'use client';

import { AppShell } from '@/lib/app-shell';
import { FormatsView } from '@/components/organisms/workspace/formats-view';

export default function FormatsPage() {
  return (
    <AppShell contentClassName="bg-background">
      <FormatsView />
    </AppShell>
  );
}
