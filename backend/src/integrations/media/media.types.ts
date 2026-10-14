export type MediaFolder = "products" | "categories" | "promotions";

export interface UploadMediaParams {
  buffer: Buffer;
  mimeType: string;
  /// Chosen by the caller to name/filename the stored object — never
  /// trusted as a filesystem path (both providers generate their own
  /// filename/public_id, ignoring the client-supplied original name).
  extension: string;
  folder: MediaFolder;
}

export interface UploadMediaResult {
  /// Publicly servable URL. Absolute for a provider with its own CDN
  /// (Cloudinary); may be relative for a provider with no host of its own
  /// (local disk) — callers resolve that against the request as needed.
  url: string;
  /// Provider-specific handle needed to delete the asset later. Undefined
  /// for a provider that has no separate delete handle (e.g. local disk,
  /// which deletes by re-deriving the file path from the URL instead).
  publicId?: string;
}

export interface MediaProvider {
  readonly key: "local" | "cloudinary";
  upload(params: UploadMediaParams): Promise<UploadMediaResult>;
  /// Best-effort — must never throw into the caller. Mirrors the previous
  /// deleteProductUploadIfOwned's fire-and-forget contract.
  delete(publicId: string): Promise<void>;
}
