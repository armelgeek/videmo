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
      // contentBounds pointe sur la region ACTIVE : le lire ICI, apres que
      // withAnnotationAwareness l'ait bascule. Le lire en haut de tick()
      // renvoyait la region precedente pendant une frame, et la main restait
      // un instant a l'ancien endroit a chaque changement de region.
      const cb = this.state.contentBounds;
      // Reset when annotation changes
      if (this.state._annotationChanged) {
        this.state.curX = 0;
        this.state.curY = 0;
        this.state.scanDir = 1;
      }

      // Use paceSpeed if annotation-aware, otherwise use speed param
      const effectiveSpeed = legacy ? speed : paceSpeed;
      const width = legacy ? cb.w : bounds.w;
      const height = legacy ? cb.h : bounds.h;
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
          } else {
            this._regionDone = true; this._flushRegion();
            this.hctx.clearRect(0, 0, this.state.canvasW, this.state.canvasH);
          }
          this.state.curX = 0;
          this.state.curY = 0;
          return;
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
      const tipY = startY + this.state.curY + bandH * 0.5;
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
