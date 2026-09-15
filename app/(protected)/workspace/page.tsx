'use client';

import { AppShell } from '@/lib/app-shell';
import { WorkspaceView } from '@/components/organisms/workspace/workspace-view';

export default function WorkspacePage() {
  return (
    <AppShell showSidebar={false} contentClassName="bg-background">
      <WorkspaceView />
    </AppShell>
  );
}
