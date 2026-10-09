import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";

// Local-disk product media storage (Phase 6M). Dev/small-deployment
// appropriate only — a real production deployment needs object storage
// (S3-compatible), since local disk does not survive redeploys or scale
// across instances. See docs/modules/CATALOG.md.
const UPLOADS_ROOT = path.join(process.cwd(), "uploads");
export const PRODUCTS_UPLOAD_DIR = path.join(UPLOADS_ROOT, "products");
const PRODUCTS_URL_PATH_PREFIX = "/uploads/products/";
export const CATEGORIES_UPLOAD_DIR = path.join(UPLOADS_ROOT, "categories");
const CATEGORIES_URL_PATH_PREFIX = "/uploads/categories/";
export const PROMOTIONS_UPLOAD_DIR = path.join(UPLOADS_ROOT, "promotions");
const PROMOTIONS_URL_PATH_PREFIX = "/uploads/promotions/";

/// Called lazily on first upload, not at boot — the directory is gitignored
/// and never committed empty.
export function ensureProductsUploadDir(): void {
  fs.mkdirSync(PRODUCTS_UPLOAD_DIR, { recursive: true });
}

/// Built from the request itself (protocol + host), never a hardcoded host
/// or a new env var — works identically in dev and behind any real deploy.
export function buildProductMediaUrl(req: Request, filename: string): string {
  return `${req.protocol}://${req.get("host")}${PRODUCTS_URL_PATH_PREFIX}${filename}`;
}

/// True only for a URL this server itself generated (our own /uploads/
/// path) — an externally-pasted image URL must never trigger a local
/// filesystem delete.
export function isOwnProductUploadUrl(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith(PRODUCTS_URL_PATH_PREFIX);
  } catch {
    return false;
  }
}

/// Best-effort, fire-and-forget: a failed unlink (already gone, permission
/// issue) must never fail the DB delete that already succeeded.
export function deleteProductUploadIfOwned(url: string): void {
  if (!isOwnProductUploadUrl(url)) return;
  const filename = path.basename(new URL(url).pathname);
  const filePath = path.join(PRODUCTS_UPLOAD_DIR, filename);
  fs.rm(filePath, { force: true }, () => {});
}

/// Called lazily on first upload, not at boot — the directory is gitignored
/// and never committed empty.
export function ensureCategoriesUploadDir(): void {
  fs.mkdirSync(CATEGORIES_UPLOAD_DIR, { recursive: true });
}

/// Built from the request itself (protocol + host), never a hardcoded host
/// or a new env var — works identically in dev and behind any real deploy.
export function buildCategoryMediaUrl(req: Request, filename: string): string {
  return `${req.protocol}://${req.get("host")}${CATEGORIES_URL_PATH_PREFIX}${filename}`;
}

/// Called lazily on first upload, not at boot — the directory is gitignored
/// and never committed empty.
export function ensurePromotionsUploadDir(): void {
  fs.mkdirSync(PROMOTIONS_UPLOAD_DIR, { recursive: true });
}

/// Built from the request itself (protocol + host), never a hardcoded host
/// or a new env var — works identically in dev and behind any real deploy.
export function buildPromotionMediaUrl(req: Request, filename: string): string {
  return `${req.protocol}://${req.get("host")}${PROMOTIONS_URL_PATH_PREFIX}${filename}`;
}
