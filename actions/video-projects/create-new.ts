'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSessionViewer } from '@/lib/video-project/session';

export async function createNewVideoProject(script?: string) {
  // `auth.getSession()` never existed, and the user's organization stopped
  // being a column on User: both are resolved here, in one place.
  const viewer = await requireSessionViewer();

  if (!viewer.organizationId) {
    throw new Error('No organization found');
  }

  const project = await db.videoProject.create({
    data: {
      organizationId: viewer.organizationId,
      createdById: viewer.userId,
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
