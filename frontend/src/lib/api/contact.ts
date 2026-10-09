import { apiFetch } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import type { ContactPayload } from "@/lib/types/contact";

export async function submitContact(payload: ContactPayload): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(ENDPOINTS.contact.submit, {
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}
