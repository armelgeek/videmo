import { LayerManager } from '@/lib/unified-engine/core/layer-manager';
import type { InkplainerLayer } from '@/lib/unified-engine/types';

describe('LayerManager', () => {
  let manager: LayerManager;

  beforeEach(() => {
    manager = new LayerManager();
  });

  test('adds a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    expect(manager.getLayers()).toHaveLength(1);
    expect(manager.getLayer('1')).toEqual(layer);
  });

  test('updates a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    const updated = manager.updateLayer('1', { opacity: 0.5 });
    expect(updated?.opacity).toBe(0.5);
  });

  test('removes a layer', () => {
    const layer: InkplainerLayer = {
      id: '1',
      name: 'test',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      opacity: 1,
      visible: true,
    };

    manager.addLayer(layer);
    expect(manager.getLayers()).toHaveLength(1);
    const removed = manager.removeLayer('1');
    expect(removed).toBe(true);
    expect(manager.getLayers()).toHaveLength(0);
  });

  test('returns null for non-existent layer', () => {
    expect(manager.getLayer('nonexistent')).toBeNull();
  });
});
