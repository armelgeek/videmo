'use client';

import { AppShell } from '@/lib/app-shell';
import { BrandView } from '@/components/organisms/workspace/brand-view';

export default function BrandPage() {
  return (
    <AppShell contentClassName="bg-background">
      <BrandView />
    </AppShell>
  );
}
