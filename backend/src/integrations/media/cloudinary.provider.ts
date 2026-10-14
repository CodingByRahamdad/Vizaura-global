import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import type { MediaProvider, UploadMediaParams, UploadMediaResult } from "./media.types.js";

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.media.cloudinary.cloudName,
    api_key: env.media.cloudinary.apiKey,
    api_secret: env.media.cloudinary.apiSecret,
    secure: true,
  });
  configured = true;
}

export class CloudinaryMediaProvider implements MediaProvider {
  readonly key = "cloudinary" as const;

  async upload(params: UploadMediaParams): Promise<UploadMediaResult> {
    ensureConfigured();
    return new Promise<UploadMediaResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `vizaura/${params.folder}`, resource_type: "image" },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload returned no result"));
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(params.buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    ensureConfigured();
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Best-effort — never block or fail the caller on a Cloudinary error.
    }
  }
}
