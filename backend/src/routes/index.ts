import { Router } from "express";
import { healthRouter } from "../modules/health/health.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoriesRouter } from "../modules/catalog/categories.routes.js";
import { productsRouter } from "../modules/catalog/products.routes.js";
import { pricingRouter } from "../modules/pricing/pricing.routes.js";
import { adminInventoryRouter, inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { cartRouter } from "../modules/cart/cart.routes.js";
import { wishlistRouter } from "../modules/wishlist/wishlist.routes.js";
import { addressesRouter } from "../modules/addresses/addresses.routes.js";
import { checkoutRouter } from "../modules/checkout/checkout.routes.js";
import { adminOrdersRouter, ordersRouter } from "../modules/orders/orders.routes.js";
import { adminPaymentsRouter, paymentsRouter } from "../modules/payments/payments.routes.js";
import { adminShippingMethodsRouter, shippingMethodsRouter } from "../modules/shipping/shipping-methods.routes.js";
import { adminShipmentsRouter, shipmentsRouter } from "../modules/shipping/shipments.routes.js";
import { adminReturnsRouter, returnsOnOrdersRouter, returnsRouter } from "../modules/returns/returns.routes.js";
import { adminAuditLogsRouter } from "../modules/audit/auditLog.routes.js";
import { adminAnalyticsRouter } from "../modules/analytics/analytics.routes.js";
import { adminUsersRouter, adminCustomersRouter } from "../modules/users/users.routes.js";
import { adminMarketsRouter, marketsRouter } from "../modules/markets/markets.routes.js";
import { productReviewsRouter } from "../modules/reviews/productReviews.routes.js";
import { reviewsRouter } from "../modules/reviews/reviews.routes.js";
import { adminReviewsRouter } from "../modules/reviews/admin.reviews.routes.js";
import { contactRouter } from "../modules/contact/contact.routes.js";
import { promotionsRouter } from "../modules/promotions/promotions.routes.js";
import { adminPromotionsRouter } from "../modules/promotions/admin.promotions.routes.js";
import { adminSearchRouter } from "../modules/search/search.routes.js";
import { adminNotificationsRouter, customerNotificationsRouter } from "../modules/notifications/notifications.routes.js";
import { defaultLimiter } from "../middleware/rateLimiters.js";

export const apiV1Router = Router();

apiV1Router.use(defaultLimiter);
apiV1Router.use(healthRouter);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/categories", categoriesRouter);
apiV1Router.use("/products", productsRouter);
apiV1Router.use("/products", pricingRouter);
apiV1Router.use("/products", inventoryRouter);
apiV1Router.use("/admin/inventory", adminInventoryRouter);
apiV1Router.use("/products", productReviewsRouter);
apiV1Router.use("/reviews", reviewsRouter);
apiV1Router.use("/admin/reviews", adminReviewsRouter);
apiV1Router.use("/cart", cartRouter);
apiV1Router.use("/wishlist", wishlistRouter);
apiV1Router.use("/addresses", addressesRouter);
apiV1Router.use("/checkout", checkoutRouter);
apiV1Router.use("/orders", ordersRouter);
apiV1Router.use("/admin/orders", adminOrdersRouter);
apiV1Router.use("/payments", paymentsRouter);
apiV1Router.use("/admin/payments", adminPaymentsRouter);
// /webhooks/payments/:provider is NOT mounted here — it's mounted directly
// in app.ts, before the global JSON body parser/CSRF middleware, since it
// needs raw-body access and provider-signature auth instead of a session.
apiV1Router.use("/shipping/methods", shippingMethodsRouter);
apiV1Router.use("/admin/shipping/methods", adminShippingMethodsRouter);
// Same "own router, shared mount prefix" pattern as Pricing/Inventory under
// "/products" — shipmentsRouter adds GET /orders/:orderId/shipment
// alongside ordersRouter's own routes, without editing orders.routes.ts.
apiV1Router.use("/orders", shipmentsRouter);
apiV1Router.use("/admin/shipments", adminShipmentsRouter);
// Same "own router, shared mount prefix" pattern as shipmentsRouter above —
// adds POST/GET /orders/:orderId/returns without editing orders.routes.ts.
apiV1Router.use("/orders", returnsOnOrdersRouter);
apiV1Router.use("/returns", returnsRouter);
apiV1Router.use("/admin/returns", adminReturnsRouter);
apiV1Router.use("/admin/audit-logs", adminAuditLogsRouter);
apiV1Router.use("/admin/analytics", adminAnalyticsRouter);
apiV1Router.use("/admin/users", adminUsersRouter);
apiV1Router.use("/admin/customers", adminCustomersRouter);
apiV1Router.use("/markets", marketsRouter);
apiV1Router.use("/admin/markets", adminMarketsRouter);
apiV1Router.use("/contact", contactRouter);
apiV1Router.use("/promotions", promotionsRouter);
apiV1Router.use("/admin/promotions", adminPromotionsRouter);
apiV1Router.use("/admin/search", adminSearchRouter);
apiV1Router.use("/admin/notifications", adminNotificationsRouter);
apiV1Router.use("/notifications", customerNotificationsRouter);
