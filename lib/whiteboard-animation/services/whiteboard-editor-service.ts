import type { WhiteboardState, WhiteboardProject } from '../types';
import type { TimelineClip, MediaItem } from '@/lib/editor/types';

/**
 * Service to integrate whiteboard editing into the main editor workflow.
 * Manages conversion between whiteboard state and editor clips/media.
 */
export class WhiteboardEditorService {
  /**
   * Create a media item from whiteboard state
   */
  static createMediaFromWhiteboard(
    whiteboardState: WhiteboardState,
    projectName: string,
    id?: string
  ): MediaItem {
    return {
      id: id || `whiteboard-${Date.now()}`,
      prompt: `Whiteboard: ${projectName}`,
      type: 'video',
      url: '', // Will be populated when rendered
      duration: whiteboardState.duration,
      resolution: {
        width: whiteboardState.canvasWidth,
        height: whiteboardState.canvasHeight,
      },
      aspectRatio: '16:9',
      status: 'ready',
    };
  }

  /**
   * Create a timeline clip from whiteboard media
   */
  static createClipFromWhiteboard(
    mediaId: string,
    startTime: number,
    duration: number,
    whiteboardState: WhiteboardState
  ): TimelineClip {
    return {
      id: `clip-whiteboard-${Date.now()}`,
      mediaId,
      start: startTime,
      duration: duration || whiteboardState.duration,
      offset: 0,
      speed: 1,
      volume: 1,
      trackId: 'v1',
    };
  }


  /**
   * Export whiteboard as canvas image
   */
  static async exportWhiteboardAsImage(
    canvas: HTMLCanvasElement,
    quality: number = 0.95
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
        },
        'image/png',
        quality
      );
    });
  }

  /**
   * Export whiteboard as video (requires FFmpeg)
   */
  static async exportWhiteboardAsVideo(
    whiteboardState: WhiteboardState,
    fps: number = 30
  ): Promise<Blob> {
    // This would require FFmpeg.wasm or a server-side encoder
    // For now, return a placeholder blob
    const errorMsg = 'Video export requires server-side processing';
    return Promise.reject(new Error(errorMsg));
  }

  /**
   * Save whiteboard project to localStorage
   */
  static saveWhiteboardProject(project: WhiteboardProject): void {
    const key = `whiteboard-project-${project.id}`;
    localStorage.setItem(key, JSON.stringify(project));
  }

  /**
   * Load whiteboard project from localStorage
   */
  static loadWhiteboardProject(projectId: string): WhiteboardProject | null {
    const key = `whiteboard-project-${projectId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * List all saved whiteboard projects
   */
  static listWhiteboardProjects(): WhiteboardProject[] {
    const projects: WhiteboardProject[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('whiteboard-project-')) {
        const data = localStorage.getItem(key);
        if (data) {
          projects.push(JSON.parse(data));
        }
      }
    }
    return projects;
  }

  /**
   * Delete a whiteboard project
   */
  static deleteWhiteboardProject(projectId: string): void {
    const key = `whiteboard-project-${projectId}`;
    localStorage.removeItem(key);
  }

  /**
   * Duplicate whiteboard state
   */
  static duplicateWhiteboardState(state: WhiteboardState): WhiteboardState {
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Merge whiteboard states
   */
  static mergeWhiteboardStates(
    base: WhiteboardState,
    updates: Partial<WhiteboardState>
  ): WhiteboardState {
    return {
      ...base,
      ...updates,
      animationOptions: {
        ...base.animationOptions,
        ...updates.animationOptions,
      },
    };
  }

  /**
   * Create a thumbnail from canvas
   */
  static createThumbnail(
    canvas: HTMLCanvasElement,
    width: number = 120,
    height: number = 67
  ): string {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;

    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, width, height);
    }

    return tempCanvas.toDataURL('image/jpeg', 0.8);
  }
}
