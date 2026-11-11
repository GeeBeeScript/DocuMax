import decodeHeic from "heic-decode";
import sharp from "sharp";
import { PipelineError } from "./errors";

const HEIC = ["image/heic", "image/heif"];
const RASTER = ["image/jpeg", "image/png", "image/webp"];

/**
 * Bytes of an uploaded image → something sharp can read. HEIC/HEIF (iPhone photos) is decoded with libheif
 * compiled to WASM, because prebuilt sharp/libvips ships without the HEVC decoder.
 */
export async function decodeImage(bytes: Uint8Array, mimeType: string): Promise<Buffer> {
  try {
    if (HEIC.includes(mimeType)) {
      const { width, height, data } = await decodeHeic({ buffer: bytes });
      return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
        raw: { width, height, channels: 4 },
      })
        .png()
        .toBuffer();
    }
    if (RASTER.includes(mimeType)) {
      await sharp(bytes, { failOn: "error" }).metadata(); // validate early, with a clear error
      return Buffer.from(bytes);
    }
  } catch {
    throw new PipelineError("unreadable_image");
  }
  throw new PipelineError("unsupported_type");
}
