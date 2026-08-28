/**
 * TypeScript wrapper for Timeline Manager
 * Handles animation timeline and playback timing
 */

export interface TimelineConfig {
  engine: any;
  project: any;
  hooks?: Record<string, any>;
}

export interface TimelineHooks {
  onPlan?: () => void;
  onPlayhead?: (ratio: number) => void;
  onRefresh?: () => void;
  onAutosave?: () => void;
  onBoutonLecture?: () => void;
  narration?: {
    stop(): void;
    element(): HTMLElement | null;
  };
}

export interface TimelineState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
}

/**
 * Type-safe wrapper for Timeline
 * Manages playback timing and animation sequencing
 */
export class Timeline {
  private jsTimeline: any;
  private state: TimelineState;

  constructor(config: TimelineConfig) {
    if (!config.engine) {
      throw new Error('Engine is required');
    }
    if (!config.project) {
      throw new Error('Project is required');
    }

    this.state = {
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      playbackRate: 1,
    };

    try {
      // Load JavaScript timeline
      const timelineModule = require('./editor/Timeline.js');
      const createTimeline = timelineModule.default || timelineModule.createTimeline || timelineModule;

      if (typeof createTimeline === 'function') {
        this.jsTimeline = createTimeline(config);
      } else {
        this.jsTimeline = timelineModule;
      }
    } catch (error) {
      console.warn('Timeline not loaded:', error);
    }
  }

  /**
   * Get current playback state
   */
  getState(): TimelineState {
    return { ...this.state };
  }

  /**
   * Play animation
   */
  play(): void {
    this.state.isPlaying = true;
    if (this.jsTimeline?.play) {
      this.jsTimeline.play();
    }
  }

  /**
   * Pause animation
   */
  pause(): void {
    this.state.isPlaying = false;
    if (this.jsTimeline?.pause) {
      this.jsTimeline.pause();
    }
  }

  /**
   * Stop and reset animation
   */
  stop(): void {
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    if (this.jsTimeline?.stop) {
      this.jsTimeline.stop();
    }
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.state.currentTime = Math.max(0, Math.min(time, this.state.duration));
    if (this.jsTimeline?.seek) {
      this.jsTimeline.seek(this.state.currentTime);
    }
  }

  /**
   * Update timeline
   */
  update(deltaTime: number): void {
    if (this.state.isPlaying) {
      this.state.currentTime += deltaTime * this.state.playbackRate;
      if (this.state.currentTime >= this.state.duration) {
        this.state.isPlaying = false;
        this.state.currentTime = this.state.duration;
      }
    }

    if (this.jsTimeline?.update) {
      this.jsTimeline.update(deltaTime);
    }
  }

  /**
   * Set playback speed/rate
   */
  setPlaybackRate(rate: number): void {
    this.state.playbackRate = Math.max(0.25, Math.min(rate, 2)); // Clamp between 0.25x and 2x
    if (this.jsTimeline?.setPlaybackRate) {
      this.jsTimeline.setPlaybackRate(this.state.playbackRate);
    }
  }

  /**
   * Set total duration
   */
  setDuration(duration: number): void {
    this.state.duration = duration;
    if (this.jsTimeline?.setDuration) {
      this.jsTimeline.setDuration(duration);
    }
  }

  /**
   * Get raw JavaScript timeline if needed
   */
  getRawTimeline(): any {
    return this.jsTimeline;
  }
}

export default Timeline;
