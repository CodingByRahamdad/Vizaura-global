import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { MediaFolder, MediaProvider, UploadMediaParams, UploadMediaResult } from "./media.types.js";

// Local-disk media storage — dev/test default only (see getMediaProvider()
// in index.ts; refused at boot in production, see config/env.ts). Does not
// survive redeploys/restarts/multi-instance scaling, which is exactly why
// production requires the Cloudinary provider instead. See
// docs/modules/CATALOG.md.
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

function uploadDirFor(folder: MediaFolder): string {
  return path.join(UPLOADS_ROOT, folder);
}

function urlPathPrefixFor(folder: MediaFolder): string {
  return `/uploads/${folder}/`;
}

export const PRODUCTS_UPLOAD_DIR = uploadDirFor("products");
export const CATEGORIES_UPLOAD_DIR = uploadDirFor("categories");
export const PROMOTIONS_UPLOAD_DIR = uploadDirFor("promotions");

export class LocalMediaProvider implements MediaProvider {
  readonly key = "local" as const;

  async upload(params: UploadMediaParams): Promise<UploadMediaResult> {
    const dir = uploadDirFor(params.folder);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${randomUUID()}${params.extension}`;
    fs.writeFileSync(path.join(dir, filename), params.buffer);
    // Relative — the provider has no host of its own; the controller
    // resolves this against the current request when building the response.
    const relativeUrl = `${urlPathPrefixFor(params.folder)}${filename}`;
    return { url: relativeUrl, publicId: relativeUrl };
  }

  async delete(publicId: string): Promise<void> {
    // publicId is the relative URL path this provider itself returned from
    // upload() (e.g. "/uploads/products/<uuid>.png") — never derived from
    // client input, so this never escapes the uploads/ root.
    const match = /^\/uploads\/(products|categories|promotions)\/([^/]+)$/.exec(publicId);
    if (!match) return;
    const [, folder, filename] = match;
    const filePath = path.join(uploadDirFor(folder as MediaFolder), filename);
    fs.rm(filePath, { force: true }, () => {});
  }
}
