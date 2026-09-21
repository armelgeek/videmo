'use client';

import { AppShell } from '@/lib/app-shell';
import { StylesView } from '@/components/organisms/workspace/styles-view';

export default function StylesPage() {
  return (
    <AppShell contentClassName="bg-background">
      <StylesView />
    </AppShell>
  );
}
