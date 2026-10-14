import { env } from "../../config/env.js";
import type { MediaProvider } from "./media.types.js";
import { LocalMediaProvider } from "./local.provider.js";
import { CloudinaryMediaProvider } from "./cloudinary.provider.js";

export type { MediaProvider, MediaFolder, UploadMediaParams, UploadMediaResult } from "./media.types.js";

let provider: MediaProvider | undefined;

export function getMediaProvider(): MediaProvider {
  if (!provider) {
    provider = env.media.provider === "cloudinary" ? new CloudinaryMediaProvider() : new LocalMediaProvider();
  }
  return provider;
}
