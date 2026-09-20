/**
 * The rectangles of the drawn subjects, measured on the image.
 *
 * Asking a vision model for coordinates does not work: checked on real
 * illustrations, it returns a point in the middle of the subject, or a frame
 * shifted from one subject to another. Yet an illustration carries its own
 * bounds — reading them is enough. The model then only has to MATCH a narration
 * beat to one of these rectangles, which it does well.
 *
 * What matters is not the color but the CONTRAST TO BACKGROUND: a black stroke
 * on white paper, a light silhouette on a dark background or a flat colored
 * area are measured the same way. Restricting the reading to dark pixels only
 * worked on a whiteboard.
 */
export interface SubjectRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The subject's pixel count: used to discard specks. */
  pixels: number;
}

export interface SubjectRegionsInput {
  /**
   * Contrast to background, per pixel, row by row: 0 = the background color,
   * 255 = its opposite. `contrastToBackground` builds it from an image.
   */
  contrast: Uint8Array;
  width: number;
  height: number;
  /** Above which a pixel belongs to a subject, not to the background. */
  threshold?: number;
  /**
   * The pixel distance under which two strokes belong to the same subject.
   * Without it, the outline of a grain and its inner slit counted as two
   * drawings.
   */
  gap?: number;
  /**
   * The image fraction under which a cluster is noise — a speck on the
   * paper, a halftone dot — and not a subject.
   */
  minSubjectRatio?: number;
}

/**
 * Groups what stands out from the background into subjects, and returns each one's rectangle.
 *
 * Grouping goes through a coarse grid rather than pixels: two neighboring
 * strokes fall into neighboring cells, so they merge, and the whole image is
 * scanned once instead of being dilated.
 */
export function subjectRegions(input: SubjectRegionsInput): SubjectRegion[] {
  const { contrast, width, height } = input;
  const threshold = input.threshold ?? 64;
  const gap = Math.max(1, input.gap ?? Math.round(Math.min(width, height) / 40));
  const minSubjectRatio = input.minSubjectRatio ?? 0.00004;

  const cols = Math.ceil(width / gap);
  const rows = Math.ceil(height / gap);

  // Per cell: the amount of subject, and the actual bounds of its pixels.
  const dense = new Int32Array(cols * rows);
  const minX = new Int32Array(cols * rows).fill(width);
  const minY = new Int32Array(cols * rows).fill(height);
  const maxX = new Int32Array(cols * rows).fill(-1);
  const maxY = new Int32Array(cols * rows).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (contrast[y * width + x] <= threshold) continue;
      const cell = Math.floor(y / gap) * cols + Math.floor(x / gap);
      dense[cell]++;
      if (x < minX[cell]) minX[cell] = x;
      if (y < minY[cell]) minY[cell] = y;
      if (x > maxX[cell]) maxX[cell] = x;
      if (y > maxY[cell]) maxY[cell] = y;
    }
  }

  const seen = new Uint8Array(cols * rows);
  const regions: SubjectRegion[] = [];
  const minPixels = Math.max(1, Math.round(width * height * minSubjectRatio));

  for (let start = 0; start < dense.length; start++) {
    if (seen[start] || dense[start] === 0) continue;

    // Traversal over neighboring cells, diagonals included: an oblique
    // stroke must not split the subject in two.
    const stack = [start];
    seen[start] = 1;
    let x0 = width;
    let y0 = height;
    let x1 = -1;
    let y1 = -1;
    let pixels = 0;

    while (stack.length > 0) {
      const cell = stack.pop() as number;
      pixels += dense[cell];
      if (minX[cell] < x0) x0 = minX[cell];
      if (minY[cell] < y0) y0 = minY[cell];
      if (maxX[cell] > x1) x1 = maxX[cell];
      if (maxY[cell] > y1) y1 = maxY[cell];

      const cx = cell % cols;
      const cy = Math.floor(cell / cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const next = ny * cols + nx;
          if (seen[next] || dense[next] === 0) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }

    if (pixels < minPixels || x1 < x0) continue;
    regions.push({
      x: x0,
      y: y0,
      width: x1 - x0 + 1,
      height: y1 - y0 + 1,
      pixels,
    });
  }

  // Most-drawn subject first: it is usually the one a beat talks about, and
  // the list sent to the model is capped.
  return regions.sort((a, b) => b.pixels - a.pixels);
}

/**
 * The background color, and each pixel's contrast to that color.
 *
 * The background is read on the image EDGE: an illustration leaves its margin
 * there, and it is the only area known in advance not to be the subject. The
 * median, not the mean, so a subject touching the edge does not shift the
 * reference.
 *
 * Contrast is taken channel by channel, the largest of the three: a red
 * silhouette on a green background has the same luminance and vanished when
 * only grayscale was considered.
 *
 * An image without a flat background — a full-page painting — yields contrast
 * everywhere, hence a single subject covering everything. That is the intended
 * fallback: an area too large rather than no annotation.
 */
export function contrastToBackground(input: {
  /** The pixels in RGBA, as a canvas returns them. */
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}): { contrast: Uint8Array; background: [number, number, number] } {
  const { rgba, width, height } = input;
  const edges: [number[], number[], number[]] = [[], [], []];

  const sample = (x: number, y: number) => {
    const p = (y * width + x) * 4;
    edges[0].push(rgba[p]);
    edges[1].push(rgba[p + 1]);
    edges[2].push(rgba[p + 2]);
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }

  const median = (values: number[]) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 255;
  };
  const background: [number, number, number] = [
    median(edges[0]),
    median(edges[1]),
    median(edges[2]),
  ];

  const contrast = new Uint8Array(width * height);
  for (let i = 0; i < contrast.length; i++) {
    const p = i * 4;
    contrast[i] = Math.max(
      Math.abs(rgba[p] - background[0]),
      Math.abs(rgba[p + 1] - background[1]),
      Math.abs(rgba[p + 2] - background[2]),
    );
  }

  return { contrast, background };
}
