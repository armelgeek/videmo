'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function createNewVideoProject(script?: string) {
  const session = await auth.getSession();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { primaryOrganizationId: true },
  });

  if (!user?.primaryOrganizationId) {
    throw new Error('No organization found');
  }

  const project = await db.videoProject.create({
    data: {
      organizationId: user.primaryOrganizationId,
      createdById: session.user.id,
      title: `Project ${new Date().toLocaleDateString()}`,
      aspectRatio: '16:9',
      params: {
        promptContent: '',
        selectedVoice: 'nova',
        language: 'en',
        animStyle: 'sketchy',
        handStyle: 'sketch',
        canvasBg: 'white',
      },
      script: script
        ? { title: '', text: script }
        : { title: '', text: '' },
      panels: [],
      whiteboardConfig: {
        animStyle: 'sketchy',
        handStyle: 'sketch',
        canvasBg: 'white',
      },
    },
  });

  redirect(`/storyboard?project=${project.id}`);
}
