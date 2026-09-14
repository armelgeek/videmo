'use client';

import { AppShell } from '@/lib/app-shell';
import { MembersView } from '@/components/organisms/workspace/members-view';

export default function MembersPage() {
  return (
    <AppShell contentClassName="bg-background">
      <MembersView />
    </AppShell>
  );
}
