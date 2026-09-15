import type { Metadata } from 'next';
import { AppShell } from '@/lib/app-shell';
import { WorkspaceView } from '@/components/organisms/workspace/workspace-view';

export const metadata: Metadata = {
  title: 'Workspace - Manage Video Projects | SketchPilot',
  description: 'Manage all your video projects, track progress, and collaborate with your team on hand-drawn explainer videos.',
  keywords: 'video projects, project management, collaboration, explainer videos',
  openGraph: {
    title: 'Workspace - Manage Your Video Projects',
    description: 'Create, manage, and track your video projects in one place',
    type: 'website',
  },
};

export default function WorkspacePage() {
  return (
    <AppShell contentClassName="bg-background">
      <WorkspaceView />
    </AppShell>
  );
}
