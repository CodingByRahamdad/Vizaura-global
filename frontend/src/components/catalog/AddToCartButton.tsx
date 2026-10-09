"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Button, type ButtonSize } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useCartWishlist } from "@/context/CartWishlistContext";

interface AddToCartButtonProps {
  variantId: string | null;
  size?: ButtonSize;
  className?: string;
}

export function AddToCartButton({ variantId, size = "sm", className }: AddToCartButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();
  const { addItem, pendingKeys } = useCartWishlist();
  const [error, setError] = useState<string | null>(null);

  if (!variantId) {
    return (
      <Button size={size} className={className} disabled>
        Add to Cart
      </Button>
    );
  }

  const isPending = pendingKeys.has(`add:${variantId}`);

  async function handleClick() {
    if (status !== "authenticated") {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setError(null);
    try {
      await addItem(variantId as string, 1);
    } catch {
      setError("Couldn't add this item to your cart.");
    }
  }

  return (
    <div className="mt-auto flex flex-col gap-1">
      <Button size={size} className={className} onClick={() => void handleClick()} isLoading={isPending}>
        Add to Cart
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
