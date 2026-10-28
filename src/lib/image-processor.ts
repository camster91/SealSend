import sharp from "sharp";

export interface WebpOptions {
  /** Longest allowed edge in pixels; smaller images are never enlarged. */
  maxSize: number;
  quality: number;
  /** Apply EXIF orientation before dropping metadata. */
  autoRotate?: boolean;
  /** Reject inputs with more pixels than this. */
  limitInputPixels?: number;
}

/** Resizes to fit within `maxSize` and re-encodes as WebP (sharp, used by Docker/Node deployments). */
export async function toWebp(input: Uint8Array, options: WebpOptions): Promise<Uint8Array> {
  let image = sharp(input, options.limitInputPixels ? { limitInputPixels: options.limitInputPixels } : undefined);
  if (options.autoRotate) image = image.rotate();
  return image
    .resize(options.maxSize, options.maxSize, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: options.quality })
    .toBuffer();
}
