import type { NextFunction, Request, Response } from "express";
import { ContactService } from "./contact.service.js";
import { successResponse } from "../../utils/apiResponse.js";
import type { ContactInput } from "./contact.validators.js";

const contactService = new ContactService();

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as ContactInput;

    // Honeypot: a real visitor never fills this hidden field. A bot that
    // does gets an identical-looking success response, with nothing
    // persisted or sent — it must never learn its submission was dropped.
    if (input.website) {
      res.status(200).json(successResponse({ ok: true }));
      return;
    }

    await contactService.submit(input);
    res.status(200).json(successResponse({ ok: true }));
  } catch (error) {
    next(error);
  }
}
