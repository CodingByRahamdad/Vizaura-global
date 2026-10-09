import { redirect } from "next/navigation";

/// The admin layout already gates on a real session; this route exists only
/// so bare /admin resolves somewhere instead of 404-ing.
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
