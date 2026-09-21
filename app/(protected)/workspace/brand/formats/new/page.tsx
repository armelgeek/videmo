'use client';

import { AppShell } from '@/lib/app-shell';
import { FormatEditor } from '@/components/organisms/workspace/formats/format-editor';

export default function NewFormatPage() {
  return (
    <AppShell contentClassName="bg-background">
      <FormatEditor initial={null} isOverride={false} />
    </AppShell>
  );
}
