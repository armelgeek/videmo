'use client';

import { AppShell } from '@/lib/app-shell';
import { StyleEditor } from '@/components/organisms/workspace/styles/style-editor';

export default function NewStylePage() {
  return (
    <AppShell contentClassName="bg-background">
      <StyleEditor initial={null} isOverride={false} />
    </AppShell>
  );
}
