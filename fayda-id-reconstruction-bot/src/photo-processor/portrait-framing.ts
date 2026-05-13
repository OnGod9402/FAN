export interface FaceVertex {
  x: number;
  y: number;
}

export interface FacePoint {
  x: number;
  y: number;
  z?: number;
}

export interface FaceLandmark {
  type: string;
  position: FacePoint;
}

export interface DetectedFace {
  boundingPoly?: { vertices: FaceVertex[] };
  fdBoundingPoly?: { vertices: FaceVertex[] };
  detectionConfidence?: number;
  landmarks?: FaceLandmark[];
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FaceSelectionOptions {
  preferredRoi?: CropRect;
  minAreaRatio?: number;
}

interface FloatRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectFromVertices(vertices?: FaceVertex[]): FloatRect | null {
  if (!vertices?.length) return null;

  const xs = vertices.map((v) => v.x);
  const ys = vertices.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    left: minX,
    top: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function unionRects(a: FloatRect | null, b: FloatRect | null): FloatRect | null {
  if (!a) return b;
  if (!b) return a;

  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  const right = Math.max(a.left + a.width, b.left + b.width);
  const bottom = Math.max(a.top + a.height, b.top + b.height);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function faceRect(face: DetectedFace): FloatRect | null {
  return unionRects(
    rectFromVertices(face.boundingPoly?.vertices),
    rectFromVertices(face.fdBoundingPoly?.vertices),
  );
}

function landmark(face: DetectedFace, type: string): FacePoint | null {
  const hit = face.landmarks?.find((item) => item.type === type)?.position;
  return hit ? { x: hit.x, y: hit.y, z: hit.z } : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampRect(rect: FloatRect, imageWidth: number, imageHeight: number): CropRect {
  const width = clamp(rect.width, 1, imageWidth);
  const height = clamp(rect.height, 1, imageHeight);
  const left = clamp(rect.left, 0, imageWidth - width);
  const top = clamp(rect.top, 0, imageHeight - height);

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function overlapRatio(rect: FloatRect, roi: CropRect): number {
  const left = Math.max(rect.left, roi.left);
  const top = Math.max(rect.top, roi.top);
  const right = Math.min(rect.left + rect.width, roi.left + roi.width);
  const bottom = Math.min(rect.top + rect.height, roi.top + roi.height);
  if (right <= left || bottom <= top) return 0;
  const overlapArea = (right - left) * (bottom - top);
  return overlapArea / (rect.width * rect.height);
}

export function selectBestFace(
  faces: DetectedFace[],
  imageWidth: number,
  imageHeight: number,
  options?: FaceSelectionOptions,
): DetectedFace | null {
  let best: DetectedFace | null = null;
  let bestScore = -Infinity;
  const minAreaRatio = options?.minAreaRatio ?? 0.004;

  for (const face of faces) {
    const rect = faceRect(face);
    if (!rect) continue;

    const areaRatio = (rect.width * rect.height) / (imageWidth * imageHeight);
    if (areaRatio < minAreaRatio) continue;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const confidence = face.detectionConfidence ?? 0.5;
    let score = confidence * 4 + Math.min(areaRatio * 40, 5);

    if (options?.preferredRoi) {
      const roi = options.preferredRoi;
      const overlap = overlapRatio(rect, roi);
      const roiCenterX = roi.left + roi.width / 2;
      const roiCenterY = roi.top + roi.height / 2;
      const dx = Math.abs(centerX - roiCenterX) / Math.max(1, roi.width);
      const dy = Math.abs(centerY - roiCenterY) / Math.max(1, roi.height);
      const centerDistancePenalty = Math.min(2.0, dx + dy);
      score += overlap * 8 - centerDistancePenalty;
    } else {
      // Legacy fallback preference when no ROI is provided.
      const leftBias = 1 - clamp(centerX / (imageWidth * 0.8), 0, 1);
      score += leftBias;
    }

    if (score > bestScore) {
      best = face;
      bestScore = score;
    }
  }

  return best;
}

export function buildPortraitCrop(
  face: DetectedFace,
  imageWidth: number,
  imageHeight: number,
  targetWidth: number,
  targetHeight: number,
): CropRect {
  const rect = faceRect(face);
  if (!rect) {
    return clampRect(
      {
        left: imageWidth * 0.08,
        top: imageHeight * 0.15,
        width: imageWidth * 0.32,
        height: imageHeight * 0.5,
      },
      imageWidth,
      imageHeight,
    );
  }

  const aspect = targetWidth / targetHeight;
  const leftEye = landmark(face, 'LEFT_EYE');
  const rightEye = landmark(face, 'RIGHT_EYE');
  const nose = landmark(face, 'NOSE_TIP');
  const chin = landmark(face, 'CHIN_GNATHION');
  const forehead = landmark(face, 'FOREHEAD_GLABELLA');
  const leftEar = landmark(face, 'LEFT_EAR_TRAGION');
  const rightEar = landmark(face, 'RIGHT_EAR_TRAGION');

  const centerX = nose?.x
    ?? (leftEye && rightEye ? (leftEye.x + rightEye.x) / 2 : rect.left + rect.width / 2);
  const eyeY = leftEye && rightEye
    ? (leftEye.y + rightEye.y) / 2
    : rect.top + rect.height * 0.38;
  const chinY = chin?.y ?? rect.top + rect.height * 0.96;
  const topAnchor = forehead?.y ?? rect.top;

  let height = Math.max(rect.height * 1.8, (chinY - eyeY) / 0.45);
  let width = Math.max(rect.width * 1.6, height * aspect);

  if (leftEar && rightEar) {
    width = Math.max(width, (rightEar.x - leftEar.x) * 1.4);
    height = Math.max(height, width / aspect);
  }

  const top = Math.max(0, Math.min(eyeY - height * 0.35, topAnchor - rect.height * 0.25));
  const left = centerX - width / 2;
  return clampRect({ left, top, width, height }, imageWidth, imageHeight);
}

export function translateFace(face: DetectedFace, offsetX: number, offsetY: number): DetectedFace {
  const shiftVertices = (vertices?: FaceVertex[]) =>
    vertices?.map((vertex) => ({ x: vertex.x + offsetX, y: vertex.y + offsetY })) ?? [];

  return {
    ...face,
    boundingPoly: face.boundingPoly ? { vertices: shiftVertices(face.boundingPoly.vertices) } : undefined,
    fdBoundingPoly: face.fdBoundingPoly ? { vertices: shiftVertices(face.fdBoundingPoly.vertices) } : undefined,
    landmarks: face.landmarks?.map((item) => ({
      ...item,
      position: {
        ...item.position,
        x: item.position.x + offsetX,
        y: item.position.y + offsetY,
      },
    })),
  };
}
