import { buildPortraitCrop, selectBestFace } from './portrait-framing';

describe('portrait framing', () => {
  it('prefers larger face inside preferred ROI over thumbnail', () => {
    const faces = [
      {
        detectionConfidence: 0.98,
        // Thumbnail-like small face
        boundingPoly: { vertices: [{ x: 40, y: 80 }, { x: 88, y: 80 }, { x: 88, y: 136 }, { x: 40, y: 136 }] },
      },
      {
        detectionConfidence: 0.9,
        // Main portrait in expected center area
        boundingPoly: { vertices: [{ x: 150, y: 70 }, { x: 280, y: 70 }, { x: 280, y: 250 }, { x: 150, y: 250 }] },
      },
    ];

    const best = selectBestFace(faces, 400, 500, {
      preferredRoi: { left: 100, top: 40, width: 220, height: 280 },
      minAreaRatio: 0.003,
    });
    expect(best).toBe(faces[1]);
  });

  it('builds a bounded portrait crop with the target aspect ratio', () => {
    const crop = buildPortraitCrop(
      {
        detectionConfidence: 0.99,
        boundingPoly: { vertices: [{ x: 50, y: 40 }, { x: 160, y: 40 }, { x: 160, y: 200 }, { x: 50, y: 200 }] },
        landmarks: [
          { type: 'LEFT_EYE', position: { x: 80, y: 95 } },
          { type: 'RIGHT_EYE', position: { x: 130, y: 95 } },
          { type: 'NOSE_TIP', position: { x: 105, y: 125 } },
          { type: 'CHIN_GNATHION', position: { x: 105, y: 210 } },
        ],
      },
      320,
      480,
      285,
      345,
    );

    expect(crop.left).toBeGreaterThanOrEqual(0);
    expect(crop.top).toBeGreaterThanOrEqual(0);
    expect(crop.left + crop.width).toBeLessThanOrEqual(320);
    expect(crop.top + crop.height).toBeLessThanOrEqual(480);
    expect(Math.abs(crop.width / crop.height - 285 / 345)).toBeLessThan(0.03);
  });
});
