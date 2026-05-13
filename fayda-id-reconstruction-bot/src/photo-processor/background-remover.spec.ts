import sharp from 'sharp';
import { BackgroundRemover } from './background-remover';

async function makePortraitLikeImage(
  width: number,
  height: number,
  bg: { r: number; g: number; b: number },
): Promise<Buffer> {
  const background = await sharp({
    create: { width, height, channels: 3, background: bg },
  })
    .png()
    .toBuffer();

  const subject = await sharp({
    create: { width: Math.round(width * 0.46), height: Math.round(height * 0.62), channels: 4, background: { r: 70, g: 52, b: 48, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([
      {
        input: subject,
        left: Math.round(width * 0.27),
        top: Math.round(height * 0.19),
      },
    ])
    .png()
    .toBuffer();
}

describe('BackgroundRemover', () => {
  const remover = new BackgroundRemover();

  async function alphaStats(buf: Buffer) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;
    let transparent = 0;
    let opaque = 0;
    for (let i = 0; i < info.width * info.height; i++) {
      const a = data[i * channels + 3];
      if (a < 20) transparent++;
      if (a > 220) opaque++;
    }
    return { transparentRatio: transparent / (info.width * info.height), opaqueRatio: opaque / (info.width * info.height), info, data };
  }

  it('removes bright popup-like background while preserving subject', async () => {
    const input = await makePortraitLikeImage(285, 420, { r: 245, g: 245, b: 245 });
    const out = await remover.removeBackground(input);
    const s = await alphaStats(out);
    expect(s.transparentRatio).toBeGreaterThan(0.1);
    expect(s.opaqueRatio).toBeGreaterThan(0.2);
  });

  it('removes tinted background without destroying portrait body region', async () => {
    const input = await makePortraitLikeImage(285, 420, { r: 206, g: 231, b: 220 });
    const out = await remover.removeBackground(input);
    const s = await alphaStats(out);
    expect(s.transparentRatio).toBeGreaterThan(0.08);

    const centerX0 = Math.floor(s.info.width * 0.3);
    const centerX1 = Math.floor(s.info.width * 0.7);
    const centerY0 = Math.floor(s.info.height * 0.2);
    const centerY1 = Math.floor(s.info.height * 0.86);
    let centerTotal = 0;
    let centerOpaque = 0;
    for (let y = centerY0; y < centerY1; y++) {
      for (let x = centerX0; x < centerX1; x++) {
        const idx = (y * s.info.width + x) * s.info.channels + 3;
        centerTotal++;
        if (s.data[idx] > 120) centerOpaque++;
      }
    }
    expect(centerOpaque / centerTotal).toBeGreaterThan(0.45);
  });
});
