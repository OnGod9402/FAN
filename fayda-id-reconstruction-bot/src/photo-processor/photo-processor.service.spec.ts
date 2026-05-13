import { Test, TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import { NvidiaFaceService } from './nvidia-face.service';
import { PhotoProcessorService } from './photo-processor.service';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 64, b: 192 } },
  })
    .png()
    .toBuffer();
}

describe('PhotoProcessorService', () => {
  let service: PhotoProcessorService;
  const nvidiaFaceService = {
    isConfigured: jest.fn(),
    detectFaces: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoProcessorService,
        { provide: NvidiaFaceService, useValue: nvidiaFaceService },
      ],
    }).compile();

    service = module.get<PhotoProcessorService>(PhotoProcessorService);
  });

  it('outputs portrait dimensions from heuristic fallback', async () => {
    nvidiaFaceService.isConfigured.mockReturnValue(false);
    const input = await makePng(640, 480);
    const output = await service.processPortrait(input);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(285);
    expect(meta.height).toBe(345);
  });

  it('preserves portrait color channels', async () => {
    nvidiaFaceService.isConfigured.mockReturnValue(false);
    const input = await makePng(200, 300);
    const output = await service.processPortrait(input);
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBeGreaterThanOrEqual(3);
    expect(data[0]).not.toBe(data[1]);
    expect(data[1]).not.toBe(data[2]);
  });

  it('uses NVIDIA face detection when configured', async () => {
    nvidiaFaceService.isConfigured.mockReturnValue(true);
    nvidiaFaceService.detectFaces
      .mockResolvedValueOnce([
        {
          detectionConfidence: 0.98,
          boundingPoly: {
            vertices: [
              { x: 20, y: 20 },
              { x: 120, y: 20 },
              { x: 120, y: 180 },
              { x: 20, y: 180 },
            ],
          },
          fdBoundingPoly: {
            vertices: [
              { x: 26, y: 26 },
              { x: 114, y: 26 },
              { x: 114, y: 174 },
              { x: 26, y: 174 },
            ],
          },
          landmarks: [
            { type: 'LEFT_EYE', position: { x: 50, y: 80 } },
            { type: 'RIGHT_EYE', position: { x: 90, y: 80 } },
            { type: 'NOSE_TIP', position: { x: 70, y: 110 } },
            { type: 'CHIN_GNATHION', position: { x: 70, y: 170 } },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          detectionConfidence: 0.91,
          boundingPoly: {
            vertices: [
              { x: 14, y: 18 },
              { x: 116, y: 18 },
              { x: 116, y: 162 },
              { x: 14, y: 162 },
            ],
          },
        },
      ]);

    const input = await makePng(400, 400);
    const output = await service.processPortrait(input);
    const meta = await sharp(output).metadata();

    expect(meta.width).toBe(285);
    expect(meta.height).toBe(345);
    expect(nvidiaFaceService.detectFaces).toHaveBeenCalledTimes(1);
  });
});
