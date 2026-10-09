"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { FormEvent } from "react";

export function ShopSearchForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const q = String(formData.get("q") ?? "").trim();

    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    params.delete("page");

    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="w-full max-w-sm">
      <Input
        type="search"
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        leftIcon={<Search className="h-4 w-4" aria-hidden />}
        placeholder="Search products..."
        aria-label="Search products in shop"
      />
    </form>
  );
}
