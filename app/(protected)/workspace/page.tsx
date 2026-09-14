'use client';

import { AppShell } from '@/lib/app-shell';
import { WorkspaceView } from '@/components/organisms/workspace/workspace-view';

export default function WorkspacePage() {
  return (
    <AppShell contentClassName="bg-neutral-950">
      <WorkspaceView />
    </AppShell>
  );
}
