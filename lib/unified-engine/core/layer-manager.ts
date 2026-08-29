import type { InkplainerLayer } from '../types';

export class LayerManager {
  private layers: InkplainerLayer[];

  constructor(initialLayers: InkplainerLayer[] = []) {
    this.layers = [...initialLayers];
  }

  addLayer(layer: InkplainerLayer): InkplainerLayer {
    this.layers.push(layer);
    return layer;
  }

  updateLayer(id: string, data: Partial<InkplainerLayer>): InkplainerLayer | null {
    const layer = this.layers.find((l) => l.id === id);
    if (!layer) return null;
    Object.assign(layer, data);
    return layer;
  }

  removeLayer(id: string): boolean {
    const index = this.layers.findIndex((l) => l.id === id);
    if (index === -1) return false;
    this.layers.splice(index, 1);
    return true;
  }

  getLayer(id: string): InkplainerLayer | null {
    return this.layers.find((l) => l.id === id) || null;
  }

  getLayers(): InkplainerLayer[] {
    return [...this.layers];
  }

  clearLayers(): void {
    this.layers = [];
  }

  clone(): LayerManager {
    return new LayerManager([...this.layers]);
  }
}
