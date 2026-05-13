import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { DetectedFace, FaceLandmark } from './portrait-framing';

// We dynamically import face-api to avoid top-level ESM issues
let faceapi: any;

@Injectable()
export class LocalFaceService implements OnModuleInit {
  private readonly logger = new Logger(LocalFaceService.name);
  private ready = false;

  async onModuleInit(): Promise<void> {
    try {
      // Dynamic import of face-api
      faceapi = await import('@vladmandic/face-api');

      // Use the CPU backend from @tensorflow/tfjs
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();

      const modelPath = path.join(
        process.cwd(),
        'node_modules',
        '@vladmandic',
        'face-api',
        'model',
      );

      // Load SSD MobileNet (face detector) + 68-point landmark model
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);

      this.ready = true;
      this.logger.log('Local face detection models loaded successfully');
    } catch (err) {
      this.logger.error(`Failed to load face detection models: ${(err as Error).message}`);
    }
  }

  isConfigured(): boolean {
    return this.ready;
  }

  private mutex: Promise<void> = Promise.resolve();

  async detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]> {
    return new Promise((resolve, reject) => {
      this.mutex = this.mutex.then(async () => {
        try {
          resolve(await this._detectFacesInternal(imageBuffer));
        } catch (err) {
          reject(err);
        }
      }).catch(reject); // ensure errors don't break the promise chain
    });
  }

  private async _detectFacesInternal(imageBuffer: Buffer): Promise<DetectedFace[]> {
    if (!this.ready || !faceapi) {
      return [];
    }

    try {
      // Create a tensor from the image buffer
      const tf = await import('@tensorflow/tfjs');
      const sharp = (await import('sharp')).default;

      // Decode image to raw pixel data using sharp
      const { data, info } = await sharp(imageBuffer)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Create a 3D tensor [height, width, 3]
      const tensor = tf.tensor3d(
        new Uint8Array(data),
        [info.height, info.width, 3],
      );

      // Run face detection with landmarks
      const detections = await faceapi
        .detectAllFaces(tensor as any, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
        .withFaceLandmarks();

      tensor.dispose();

      this.logger.debug(`Local face detector found ${detections.length} face(s)`);

      return detections.map((det: any) => this.normalizeFaceApi(det));
    } catch (err) {
      this.logger.warn(`Local face detection failed: ${(err as Error).message}`);
      return [];
    }
  }

  private normalizeFaceApi(detection: any): DetectedFace {
    const box = detection.detection.box;
    const score = detection.detection.score;

    const boundingPoly = {
      vertices: [
        { x: box.x, y: box.y },
        { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height },
        { x: box.x, y: box.y + box.height },
      ],
    };

    // Extract landmarks that buildPortraitCrop uses
    const landmarks: FaceLandmark[] = [];
    const lm = detection.landmarks;

    if (lm) {
      const leftEye = lm.getLeftEye();
      const rightEye = lm.getRightEye();
      const nose = lm.getNose();
      const jaw = lm.getJawOutline();

      if (leftEye?.length) {
        const avg = this.avgPoints(leftEye);
        landmarks.push({ type: 'LEFT_EYE', position: avg });
      }
      if (rightEye?.length) {
        const avg = this.avgPoints(rightEye);
        landmarks.push({ type: 'RIGHT_EYE', position: avg });
      }
      if (nose?.length) {
        // Nose tip is the bottom point of the nose
        const tip = nose[nose.length - 1];
        landmarks.push({ type: 'NOSE_TIP', position: { x: tip.x, y: tip.y } });
      }
      if (jaw?.length) {
        // Chin is the bottom-middle of jawline
        const chin = jaw[Math.floor(jaw.length / 2)];
        landmarks.push({ type: 'CHIN_GNATHION', position: { x: chin.x, y: chin.y } });
      }

      // Forehead — estimate above the nose bridge (between the eyes, above)
      if (leftEye?.length && rightEye?.length) {
        const leAvg = this.avgPoints(leftEye);
        const reAvg = this.avgPoints(rightEye);
        const foreheadX = (leAvg.x + reAvg.x) / 2;
        const eyeY = (leAvg.y + reAvg.y) / 2;
        const faceHeight = box.height;
        const foreheadY = eyeY - faceHeight * 0.15;
        landmarks.push({ type: 'FOREHEAD_GLABELLA', position: { x: foreheadX, y: foreheadY } });
      }

      // Ear tragion estimates from jaw endpoints
      if (jaw?.length >= 2) {
        landmarks.push({ type: 'LEFT_EAR_TRAGION', position: { x: jaw[0].x, y: jaw[0].y } });
        landmarks.push({ type: 'RIGHT_EAR_TRAGION', position: { x: jaw[jaw.length - 1].x, y: jaw[jaw.length - 1].y } });
      }
    }

    return {
      boundingPoly,
      detectionConfidence: score,
      landmarks,
    };
  }

  private avgPoints(points: Array<{ x: number; y: number }>): { x: number; y: number } {
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
}
