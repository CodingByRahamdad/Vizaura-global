import { formatOrderMoney } from "@/lib/utils/adminOrderFormat";

interface TopProductsListProps {
  products: { productId: string | null; productName: string; quantitySold: number; revenue: number }[];
  currencyCode: string;
}

export function TopProductsList({ products, currencyCode }: TopProductsListProps) {
  if (products.length === 0) {
    return <p className="text-sm text-text-secondary">No sales recorded in this period yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {products.map((product, index) => (
        <li key={product.productId ?? product.productName} className="flex items-center gap-3">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              index === 0 ? "bg-warning/20 text-warning" : "bg-bg text-text-secondary"
            }`}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{product.productName}</p>
            <p className="text-xs text-text-secondary">{formatOrderMoney(product.revenue, currencyCode)}</p>
          </div>
          <span className="shrink-0 text-xs text-text-secondary">{product.quantitySold} units</span>
        </li>
      ))}
    </ul>
  );
}
