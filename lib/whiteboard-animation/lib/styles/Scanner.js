const Animation = require('../Animation');

class Scanner extends Animation {
  setup() {
    this.state.curX = 0;
    this.state.curY = 0;
    this.state.scanDir = 1;
  }

  tick(speed, deltaMs = 16.67) {
    const bandH = 48;

    this.withAnnotationAwareness(deltaMs, (annot, bounds, paceSpeed, legacy) => {
      // contentBounds points to the ACTIVE region: read it HERE, after
      // withAnnotationAwareness has switched it. Reading it at the top of tick()
      // returned the previous region for one frame, and the hand lingered
      // briefly at the old spot on every region change.
      const cb = this.state.contentBounds;
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.curX = 0;
        this.state.curY = 0;
        this.state.scanDir = 1;
      }

      const width = legacy ? cb.w : bounds.w;
      const height = legacy ? cb.h : bounds.h;
      let effectiveSpeed = legacy ? speed : paceSpeed;
      // Speed recomputed on the gesture's remaining time: each line return
      // loses a frame, and a fixed speed finished late.
      if (!legacy && this._regionDuration > 0 && this._frames) {
        const rows = Math.ceil(height / bandH);
        const rowIdx = Math.floor(this.state.curY / bandH);
        const travelled = rowIdx * width + (this.state.scanDir === 1 ? this.state.curX : width - this.state.curX);
        const remaining = Math.max(0, rows * width - travelled);
        const framesLeft = Math.max(1, Math.round((1 - this._regionElapsed / this._regionDuration) * this._frames));
        effectiveSpeed = Math.max(1, remaining / framesLeft);
      }
      const startX = legacy ? cb.x : cb.x + bounds.x;
      const startY = legacy ? cb.y : cb.y + bounds.y;

      const absX = startX + this.state.curX;
      const absY = startY + this.state.curY;
      const sw = Math.min(effectiveSpeed, width - this.state.curX);
      const sh = Math.min(bandH, height - this.state.curY);

      // ponytail: no fillBg here - the scan accumulates bands onto the canvas.
      // Clearing each frame wipes everything already revealed.
      this.ctx.drawImage(this.offscreen, absX, absY, sw, sh, absX, absY, sw, sh);

      this.state.curX += effectiveSpeed * this.state.scanDir;

      if (this.state.curX >= width || this.state.curX < 0) {
        this.ctx.drawImage(this.offscreen, startX, absY, width, sh, startX, absY, width, sh);

        this.state.curY += bandH;
        if (this.state.curY >= height) {
          if (legacy) {
            this.finishAnim();
            return;
          } else {
            this._regionDone = true;
            this._flushRegion();
          }
          this.state.curX = 0;
          this.state.curY = Math.max(0, height - bandH);
        }
        if (this.state.zigzag) {
          this.state.scanDir *= -1;
          this.state.curX = this.state.scanDir === 1 ? 0 : width - effectiveSpeed;
        } else {
          this.state.scanDir = 1;
          this.state.curX = 0;
        }
      }

      const tipX = startX + this.state.curX + (this.state.scanDir === 1 ? 0 : effectiveSpeed);
      // ACTUAL half-band: a region's height is almost never a multiple of
      // bandH, so the last row is truncated (2px on the title region). A full
      // half-band put the tip up to 24px BELOW the annotation's bottom edge
      // during the whole final sweep. curY may have changed just above, so
      // `sh` cannot be reused.
      const currentBand = Math.min(bandH, height - this.state.curY);
      const tipY = startY + this.state.curY + currentBand * 0.5;
      this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
      this.drawHand(this.hctx, tipX, tipY, this.state.scanDir, this.state.hand);

      if (legacy) {
        this.setProgress((this.state.curY + (this.state.curX / width) * bandH) / height);
      } else {
        // Progress within annotation
        const annotProgress = (this.state.curY + (this.state.curX / width) * bandH) / height;
        const idx = annot ? this.state.annotations.indexOf(annot) : 0;
        const totalProgress = (idx / Math.max(1, this.state.annotations.length)) + (annotProgress / this.state.annotations.length);
        this.setProgress(totalProgress);
      }
    });
  }
}

module.exports = Scanner;
