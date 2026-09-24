import { describe, expect, it } from 'vitest';
import { project, scaleAtScreenY, unproject, type Tilt } from '../../src/game/battle/projection';

const tilt: Tilt = { cx: 180, top: 16, bottom: 349, screenTop: 40, far: 0.76, squash: 0.7 };

describe('board tilt', () => {
  it('keeps rows in order and shrinks them toward the far edge', () => {
    let last = project(tilt, 180, tilt.top);
    for (let y = tilt.top + 10; y <= tilt.bottom; y += 10) {
      const next = project(tilt, 180, y);
      expect(next.y).toBeGreaterThan(last.y);
      expect(next.scale).toBeGreaterThan(last.scale);
      last = next;
    }
    expect(project(tilt, 180, tilt.top).scale).toBeCloseTo(tilt.far);
    expect(project(tilt, 180, tilt.bottom).scale).toBeCloseTo(1);
  });

  it('finds the flat point under any screen point', () => {
    for (const [x, y] of [
      [20, 16],
      [180, 200],
      [340, 349],
      [90, 120],
    ]) {
      const on = project(tilt, x, y);
      const back = unproject(tilt, on.x, on.y);
      expect(back.x).toBeCloseTo(x);
      expect(back.y).toBeCloseTo(y);
      expect(scaleAtScreenY(tilt, on.y)).toBeCloseTo(on.scale);
    }
  });
});
