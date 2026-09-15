import { appConfig } from "@/lib/config";
import { EmailService } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";

export async function notifyRenderReady(params: {
  userId: string;
  jobId: string;
  projectId: string | null;
  expiryHours: number;
}): Promise<void> {
  const [user, project] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, name: true },
    }),
    params.projectId
      ? prisma.videoProject.findUnique({
          where: { id: params.projectId },
          select: { title: true },
        })
      : null,
  ]);
  if (!user) return;

  await new EmailService().sendEmail({
    type: "video_ready",
    recipients: [user.email],
    subject: project ? `Your video "${project.title}" is ready` : "Your video is ready",
    data: {
      recipientEmail: user.email,
      recipientName: user.name,
      videoTitle: project?.title ?? "your video",
      downloadUrl: `${appConfig.url}/api/whiteboard/render/${params.jobId}/file`,
      expiryHours: params.expiryHours,
    },
  });
}
