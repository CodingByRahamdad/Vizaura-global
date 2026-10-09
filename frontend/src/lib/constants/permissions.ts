/**
 * Literal transcription of backend/prisma/seed.ts's permissionMatrix — the
 * single frontend source of truth for real permission keys. Never add a key
 * here that isn't seeded backend-side; if a future admin feature needs one
 * that doesn't exist yet, document the gap instead of inventing it (see
 * ADMIN_NAV_LINKS's Settings entry in constants/admin-nav.ts for an example).
 */
export const PERMISSIONS = {
  productsCreate: "products:create",
  productsRead: "products:read",
  productsUpdate: "products:update",
  productsDelete: "products:delete",

  categoriesCreate: "categories:create",
  categoriesRead: "categories:read",
  categoriesUpdate: "categories:update",
  categoriesDelete: "categories:delete",

  pricingRead: "pricing:read",
  pricingUpdate: "pricing:update",

  inventoryRead: "inventory:read",
  inventoryUpdate: "inventory:update",

  ordersRead: "orders:read",
  ordersCreate: "orders:create",
  ordersUpdate: "orders:update",
  ordersCancel: "orders:cancel",
  ordersRefund: "orders:refund",
  ordersDelete: "orders:delete",

  paymentsRead: "payments:read",
  paymentsRefund: "payments:refund",
  paymentsUpdate: "payments:update",

  shippingRead: "shipping:read",
  shippingUpdate: "shipping:update",

  returnsRead: "returns:read",
  returnsUpdate: "returns:update",

  customersRead: "customers:read",
  customersUpdate: "customers:update",
  customersCreate: "customers:create",
  customersDelete: "customers:delete",

  promotionsCreate: "promotions:create",
  promotionsRead: "promotions:read",
  promotionsUpdate: "promotions:update",
  promotionsDelete: "promotions:delete",

  reviewsRead: "reviews:read",
  reviewsModerate: "reviews:moderate",
  reviewsDelete: "reviews:delete",

  cmsCreate: "cms:create",
  cmsRead: "cms:read",
  cmsUpdate: "cms:update",
  cmsDelete: "cms:delete",
  cmsPublish: "cms:publish",

  marketsRead: "markets:read",
  marketsUpdate: "markets:update",

  usersCreate: "users:create",
  usersRead: "users:read",
  usersUpdate: "users:update",
  usersDelete: "users:delete",

  rolesCreate: "roles:create",
  rolesRead: "roles:read",
  rolesUpdate: "roles:update",
  rolesDelete: "roles:delete",
  rolesAssign: "roles:assign",

  analyticsRead: "analytics:read",

  auditRead: "audit:read",

  notificationsRead: "notifications:read",
  notificationsUpdate: "notifications:update",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
