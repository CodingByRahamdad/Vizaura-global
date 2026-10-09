import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { catalogErrors } from "../../errors/AppError.js";
import {
  CATEGORIES_UPLOAD_DIR,
  ensureCategoriesUploadDir,
  ensureProductsUploadDir,
  ensurePromotionsUploadDir,
  PRODUCTS_UPLOAD_DIR,
  PROMOTIONS_UPLOAD_DIR,
} from "./mediaStorage.js";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";

function createImageUploadMiddleware(uploadDir: string, ensureDir: () => void) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir();
      cb(null, uploadDir);
    },
    // Uuid filename — never trusts the client-supplied original filename.
    filename: (_req, file, cb) => {
      const ext = ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
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

export const productMediaUpload = createImageUploadMiddleware(PRODUCTS_UPLOAD_DIR, ensureProductsUploadDir);
export const categoryImageUpload = createImageUploadMiddleware(CATEGORIES_UPLOAD_DIR, ensureCategoriesUploadDir);
export const promotionImageUpload = createImageUploadMiddleware(PROMOTIONS_UPLOAD_DIR, ensurePromotionsUploadDir);
