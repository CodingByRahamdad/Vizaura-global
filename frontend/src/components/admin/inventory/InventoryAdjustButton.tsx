"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StockAdjustDialog } from "@/components/admin/inventory/StockAdjustDialog";

interface InventoryAdjustButtonProps {
  productId: string;
  variantId: string;
  marketCode: string;
  productName: string;
  onHand: number;
}

export function InventoryAdjustButton({
  productId,
  variantId,
  marketCode,
  productName,
  onHand,
}: InventoryAdjustButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Adjust
      </Button>
      <StockAdjustDialog
        open={open}
        productId={productId}
        variantId={variantId}
        marketCode={marketCode}
        productName={productName}
        currentOnHand={onHand}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
