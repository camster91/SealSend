import { getBinding } from "@/lib/runtime-bindings";
import type { WebpOptions } from "@/lib/image-processor";

interface ImagesBinding {
  input(source: ReadableStream<Uint8Array>): ImageHandle;
  info(source: ReadableStream<Uint8Array>): Promise<{ width?: number; height?: number }>;
}
interface ImageHandle {
  transform(options: Record<string, unknown>): ImageHandle;
  output(options: { format: string; quality?: number }): Promise<{ response(): Response }>;
}

function toReadableStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Same contract as image-processor.ts, backed by the Cloudflare Images binding (no sharp on Workers). */
export async function toWebp(input: Uint8Array, options: WebpOptions): Promise<Uint8Array> {
  const images = getBinding<ImagesBinding>("IMAGES");
  if (!images) throw new Error("IMAGES binding is not configured");
  if (options.limitInputPixels) {
    const { width = 0, height = 0 } = await images.info(toReadableStream(input));
    if (width * height > options.limitInputPixels) throw new Error("Image has too many pixels");
  }
  // Cloudflare applies EXIF orientation and strips metadata, matching the sharp path with autoRotate.
  const result = await images
    .input(toReadableStream(input))
    .transform({ width: options.maxSize, height: options.maxSize, fit: "scale-down" })
    .output({ format: "image/webp", quality: options.quality });
  return new Uint8Array(await result.response().arrayBuffer());
}
