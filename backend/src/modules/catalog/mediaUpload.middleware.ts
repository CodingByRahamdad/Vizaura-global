import path from "node:path";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { catalogErrors } from "../../errors/AppError.js";

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";

export function extensionFor(file: { mimetype: string; originalname: string }): string {
  return ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
}

/// A media provider (see integrations/media/) may return an absolute URL
/// (Cloudinary, which has its own CDN host) or a relative one (local disk,
/// which has none) — this resolves the latter against the current request,
/// exactly how the old buildXMediaUrl helpers did, and passes the former
/// through unchanged.
export function toAbsoluteMediaUrl(req: Request, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${req.protocol}://${req.get("host")}${url}`;
}

function createImageUploadMiddleware() {
  const upload = multer({
    // Streamed straight to the configured media provider (see
    // integrations/media/) — never written to disk here, so this works
    // identically whether the provider is local or Cloudinary.
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!(file.mimetype in ALLOWED_MIME_TYPES)) {
        cb(new Error(UNSUPPORTED_MEDIA_TYPE));
        return;
      }
      cb(null, true);
    },
  }).single("file");

  /// Wraps multer's callback-style middleware so its errors flow into this
  /// app's standard AppError/errorHandler.ts convention instead of a raw
  /// MulterError/Error reaching the client.
  return function handleUpload(req: Request, res: Response, next: NextFunction): void {
    upload(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        next(
          catalogErrors.validation({
            fields: [{ path: "file", message: "File exceeds the 5MB limit." }],
          }),
        );
        return;
      }
      if (err instanceof Error && err.message === UNSUPPORTED_MEDIA_TYPE) {
        next(
          catalogErrors.validation({
            fields: [{ path: "file", message: "Unsupported file type. Use JPEG, PNG, or WEBP." }],
          }),
        );
        return;
      }
      next(err);
    });
  };
}

export const productMediaUpload = createImageUploadMiddleware();
export const categoryImageUpload = createImageUploadMiddleware();
export const promotionImageUpload = createImageUploadMiddleware();
