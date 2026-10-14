import type { NextFunction, Request, Response } from "express";
import { VariantsService } from "./variants.service.js";
import { toMediaResponse, toOptionResponse, toOptionValueResponse, toVariantResponse } from "./variants.mapper.js";
import { successResponse } from "../../utils/apiResponse.js";
import { catalogErrors } from "../../errors/AppError.js";
import { toAbsoluteMediaUrl, extensionFor } from "./mediaUpload.middleware.js";
import { getMediaProvider } from "../../integrations/media/index.js";
import type {
  AddOptionValueInput,
  CreateMediaInput,
  CreateOptionInput,
  CreateVariantInput,
  MediaParams,
  OptionParams,
  OptionValueParams,
  ProductIdParams,
  UpdateMediaInput,
  UpdateOptionInput,
  UpdateVariantInput,
  VariantParams,
} from "./variants.validators.js";

const variantsService = new VariantsService();

// -- Variants ---------------------------------------------------------------

export async function createVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductIdParams;
    const variant = await variantsService.createVariant(productId, req.body as CreateVariantInput);
    res.status(201).json(successResponse(toVariantResponse(variant)));
  } catch (error) {
    next(error);
  }
}

export async function listVariants(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductIdParams;
    const canSeeAllStatuses = req.auth?.permissions.has("products:read") ?? false;
    const variants = await variantsService.listVariants(productId, canSeeAllStatuses);
    res.status(200).json(successResponse(variants.map(toVariantResponse)));
  } catch (error) {
    next(error);
  }
}

export async function updateVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId } = req.params as unknown as VariantParams;
    const variant = await variantsService.updateVariant(productId, variantId, req.body as UpdateVariantInput);
    res.status(200).json(successResponse(toVariantResponse(variant)));
  } catch (error) {
    next(error);
  }
}

export async function removeVariant(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, variantId } = req.params as unknown as VariantParams;
    await variantsService.removeVariant(productId, variantId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// -- Options ------------------------------------------------------------

export async function createOption(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductIdParams;
    const option = await variantsService.createOption(productId, req.body as CreateOptionInput);
    res.status(201).json(successResponse(toOptionResponse(option)));
  } catch (error) {
    next(error);
  }
}

export async function updateOption(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, optionId } = req.params as unknown as OptionParams;
    const option = await variantsService.updateOption(productId, optionId, req.body as UpdateOptionInput);
    res.status(200).json(successResponse(toOptionResponse(option)));
  } catch (error) {
    next(error);
  }
}

export async function removeOption(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, optionId } = req.params as unknown as OptionParams;
    await variantsService.removeOption(productId, optionId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function addOptionValue(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, optionId } = req.params as unknown as OptionParams;
    const value = await variantsService.addOptionValue(productId, optionId, req.body as AddOptionValueInput);
    res.status(201).json(successResponse(toOptionValueResponse(value)));
  } catch (error) {
    next(error);
  }
}

export async function removeOptionValue(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, optionId, valueId } = req.params as unknown as OptionValueParams;
    await variantsService.removeOptionValue(productId, optionId, valueId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// -- Media --------------------------------------------------------------

export async function createMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductIdParams;
    const media = await variantsService.createMedia(productId, req.body as CreateMediaInput);
    res.status(201).json(successResponse(toMediaResponse(media)));
  } catch (error) {
    next(error);
  }
}

export async function updateMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, mediaId } = req.params as unknown as MediaParams;
    const media = await variantsService.updateMedia(productId, mediaId, req.body as UpdateMediaInput);
    res.status(200).json(successResponse(toMediaResponse(media)));
  } catch (error) {
    next(error);
  }
}

export async function removeMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId, mediaId } = req.params as unknown as MediaParams;
    const deleted = await variantsService.removeMedia(productId, mediaId);
    // Only deletes an asset this server generated via upload (tracked by
    // mediaPublicId) — an externally-pasted URL row has no publicId and is
    // left alone. Best-effort, never blocks the response on a provider error.
    if (deleted.mediaPublicId) {
      void getMediaProvider().delete(deleted.mediaPublicId);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/// Multipart upload — multer (mediaUpload.middleware.ts) has already
/// validated type/size and buffered the file in memory by the time this
/// runs; this uploads the buffer to the configured media provider
/// (integrations/media/) and reuses the exact same
/// VariantsService.createMedia the URL-entry endpoint uses, so every
/// invariant (isPrimary/position handling) stays single-sourced.
export async function uploadMedia(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params as unknown as ProductIdParams;
    if (!req.file) {
      throw catalogErrors.validation({ fields: [{ path: "file", message: "No file was uploaded." }] });
    }

    const body = req.body as Record<string, unknown>;
    const altText = typeof body.altText === "string" && body.altText.trim() !== "" ? body.altText : undefined;
    const variantId = typeof body.variantId === "string" && body.variantId !== "" ? body.variantId : undefined;
    const isPrimary = body.isPrimary === "true" ? true : undefined;

    const result = await getMediaProvider().upload({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      extension: extensionFor(req.file),
      folder: "products",
    });

    const media = await variantsService.createMedia(productId, {
      url: toAbsoluteMediaUrl(req, result.url),
      mediaPublicId: result.publicId,
      altText,
      variantId,
      isPrimary,
    });
    res.status(201).json(successResponse(toMediaResponse(media)));
  } catch (error) {
    next(error);
  }
}
