/**
 * Path constants mirroring the backend's documented /api/v1 domains
 * (docs/API_CONTRACTS.md). Paths only — no fetch calls or business logic.
 * Consumed by feature phases once real requests are wired up.
 */
export const ENDPOINTS = {
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    logout: "/auth/logout",
    logoutAll: "/auth/logout-all",
    refresh: "/auth/refresh",
    me: "/auth/me",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    verifyEmail: "/auth/verify-email",
    resendVerification: "/auth/resend-verification",
    changePassword: "/auth/change-password",
    changeEmail: "/auth/change-email",
  },
  markets: {
    list: "/markets",
  },
  products: {
    list: "/products",
    detail: (id: string) => `/products/${id}`,
    detailBySlug: (slug: string) => `/products/slug/${slug}`,
    categories: (id: string) => `/products/${id}/categories`,
    market: (id: string, marketCode: string) => `/products/${id}/markets/${marketCode}`,
    variants: (id: string) => `/products/${id}/variants`,
    variant: (id: string, variantId: string) => `/products/${id}/variants/${variantId}`,
    options: (id: string) => `/products/${id}/options`,
    option: (id: string, optionId: string) => `/products/${id}/options/${optionId}`,
    optionValues: (id: string, optionId: string) => `/products/${id}/options/${optionId}/values`,
    optionValue: (id: string, optionId: string, valueId: string) =>
      `/products/${id}/options/${optionId}/values/${valueId}`,
    media: (id: string) => `/products/${id}/media`,
    mediaItem: (id: string, mediaId: string) => `/products/${id}/media/${mediaId}`,
    prices: (productId: string, variantId: string) => `/products/${productId}/variants/${variantId}/prices`,
    price: (productId: string, variantId: string, marketCode: string) =>
      `/products/${productId}/variants/${variantId}/prices/${marketCode}`,
    stockList: (productId: string, variantId: string) => `/products/${productId}/variants/${variantId}/stock`,
    stock: (productId: string, variantId: string, marketCode: string) =>
      `/products/${productId}/variants/${variantId}/stock/${marketCode}`,
    stockAdjust: (productId: string, variantId: string, marketCode: string) =>
      `/products/${productId}/variants/${variantId}/stock/${marketCode}/adjust`,
  },
  categories: {
    list: "/categories",
    detail: (id: string) => `/categories/${id}`,
    uploadImage: "/categories/upload-image",
  },
  cart: {
    root: "/cart",
    items: "/cart/items",
    item: (itemId: string) => `/cart/items/${itemId}`,
  },
  checkout: {
    root: "/checkout",
  },
  orders: {
    list: "/orders",
    detail: (id: string) => `/orders/${id}`,
  },
  payments: {
    root: "/payments",
    refund: (id: string) => `/payments/${id}/refund`,
  },
  shipping: {
    root: "/shipping",
    methods: "/shipping/methods",
  },
  addresses: {
    root: "/addresses",
    billing: "/addresses/billing",
    shipping: "/addresses/shipping",
  },
  reviews: {
    forProduct: (productId: string) => `/products/${productId}/reviews`,
    summaryForProduct: (productId: string) => `/products/${productId}/reviews/summary`,
    mineForProduct: (productId: string) => `/products/${productId}/reviews/mine`,
    featured: "/reviews/featured",
    all: "/reviews",
    detail: (id: string) => `/reviews/${id}`,
  },
  wishlist: {
    root: "/wishlist",
    items: "/wishlist/items",
    item: (productId: string) => `/wishlist/items/${productId}`,
  },
  promotions: {
    root: "/promotions",
    active: "/promotions/active",
  },
  inventory: {
    root: "/inventory",
  },
  admin: {
    root: "/admin",
    auditLogs: "/admin/audit-logs",
    inventory: "/admin/inventory",
    orders: "/admin/orders",
    order: (id: string) => `/admin/orders/${id}`,
    orderStatus: (id: string) => `/admin/orders/${id}/status`,
    paymentMarkPaid: (id: string) => `/admin/payments/${id}/mark-paid`,
    paymentMarkFailed: (id: string) => `/admin/payments/${id}/mark-failed`,
    paymentMarkRefunded: (id: string) => `/admin/payments/${id}/mark-refunded`,
    shipmentUpdate: (id: string) => `/admin/shipments/${id}`,
    returnApprove: (id: string) => `/admin/returns/${id}/approve`,
    returnReject: (id: string) => `/admin/returns/${id}/reject`,
    returnReceive: (id: string) => `/admin/returns/${id}/receive`,
    returnRefund: (id: string) => `/admin/returns/${id}/refund`,
    analyticsDashboard: "/admin/analytics/dashboard",
    users: "/admin/users",
    user: (id: string) => `/admin/users/${id}`,
    userStatus: (id: string) => `/admin/users/${id}/status`,
    userRole: (id: string) => `/admin/users/${id}/role`,
    userResetPassword: (id: string) => `/admin/users/${id}/reset-password`,
    markets: "/admin/markets",
    market: (id: string) => `/admin/markets/${id}`,
    customers: "/admin/customers",
    customer: (id: string) => `/admin/customers/${id}`,
    customerStatus: (id: string) => `/admin/customers/${id}/status`,
    productMediaUpload: (productId: string) => `/products/${productId}/media/upload`,
    reviews: "/admin/reviews",
    review: (id: string) => `/admin/reviews/${id}`,
    promotions: "/admin/promotions",
    promotion: (id: string) => `/admin/promotions/${id}`,
    promotionUploadImage: "/admin/promotions/upload-image",
    promotionsBroadcast: "/admin/promotions/broadcast",
    search: "/admin/search",
    notifications: "/admin/notifications",
    notificationsUnreadCount: "/admin/notifications/unread-count",
    notificationRead: (id: string) => `/admin/notifications/${id}/read`,
    notificationsReadAll: "/admin/notifications/read-all",
  },
  analytics: {
    root: "/analytics",
  },
  notifications: {
    root: "/notifications",
    unreadCount: "/notifications/unread-count",
    readAll: "/notifications/read-all",
    read: (id: string) => `/notifications/${id}/read`,
  },
  contact: {
    submit: "/contact",
  },
} as const;
