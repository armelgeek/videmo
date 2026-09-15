import type { Metadata } from 'next';
import { AppShell } from '@/lib/app-shell';
import { WorkspaceView } from '@/components/organisms/workspace/workspace-view';

export const metadata: Metadata = {
  title: 'Workspace | Manage Your Projects',
  description: 'Manage your video projects and collaborate with your team',
};

export default function WorkspacePage() {
  return (
    <AppShell contentClassName="bg-background">
      <WorkspaceView />
    </AppShell>
  );
}
