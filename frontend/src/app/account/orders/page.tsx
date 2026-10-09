import { OrdersListView } from "@/components/orders/OrdersListView";

export default function OrdersPage() {
  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-text">My Orders</h1>
      <OrdersListView />
    </div>
  );
}
