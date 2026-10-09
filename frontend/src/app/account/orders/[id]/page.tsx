import { OrderDetailView } from "@/components/orders/OrderDetailView";

export default async function OrderDetailPage({
  params,
  searchParams,
}: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const search = await searchParams;
  const justPlaced = search?.placed === "1";

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-text">Order Details</h1>
      <OrderDetailView orderId={id} justPlaced={justPlaced} />
    </div>
  );
}
