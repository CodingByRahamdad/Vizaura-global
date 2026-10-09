import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DUMMY_PASSWORD_HASH } from "../src/security/password.js";

// Development seed — foundational reference data, plus a small demo catalog
// (categories/products/reviews) so the storefront homepage has real content
// to render instead of empty states (see Phase 5C-1 Revision).
//
// Seeds markets, RBAC permissions, roles, and a demo catalog/reviews. It
// deliberately creates no orders/payments and no admin user (bootstrapping
// an admin requires a password and belongs to the auth phase). The demo
// review authors get a placeholder password hash — they exist only to
// attribute seeded reviews, not to log in.
//
// Every write is an upsert (or an explicit find-then-create-if-missing for
// models with no natural unique key), so this script is safe to re-run.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const markets = [
  {
    code: "PK",
    name: "Pakistan",
    currencyCode: "PKR",
    currencyMinorUnits: 2,
    timezone: "Asia/Karachi",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    currencyCode: "AED",
    currencyMinorUnits: 2,
    timezone: "Asia/Dubai",
  },
];

// Minor-unit amounts (2dp), aligned with the storefront header's own existing
// "Free Shipping on orders above 10,000 PKR / 300 AED" copy so seeded data
// doesn't contradict on-page marketing text.
const shippingMethods: {
  marketCode: string;
  name: string;
  description: string;
  baseRate: number;
  freeShippingThreshold: number | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  isPublic?: boolean;
}[] = [
  {
    marketCode: "PK",
    name: "Standard Shipping",
    description: "Delivered in 3-5 business days.",
    baseRate: 25000,
    freeShippingThreshold: 1000000,
    estimatedMinDays: 3,
    estimatedMaxDays: 5,
  },
  {
    marketCode: "AE",
    name: "Standard Shipping",
    description: "Delivered in 2-4 business days.",
    baseRate: 2500,
    freeShippingThreshold: 30000,
    estimatedMinDays: 2,
    estimatedMaxDays: 4,
  },
  // Non-public: exists only to satisfy Shipment.shippingMethodId's required
  // FK for admin-entered offline orders (phone/WhatsApp/walk-in). isPublic:
  // false keeps it out of the storefront checkout's shipping-method list —
  // see shipping-methods.repository.ts's customer-facing query.
  {
    marketCode: "PK",
    name: "Manual",
    description: "Used for offline/custom orders entered by staff.",
    baseRate: 0,
    freeShippingThreshold: null,
    estimatedMinDays: null,
    estimatedMaxDays: null,
    isPublic: false,
  },
  {
    marketCode: "AE",
    name: "Manual",
    description: "Used for offline/custom orders entered by staff.",
    baseRate: 0,
    freeShippingThreshold: null,
    estimatedMinDays: null,
    estimatedMaxDays: null,
    isPublic: false,
  },
];

// Permissions follow the documented `resource:action` convention (docs/RBAC.md).
const permissionMatrix: Record<string, string[]> = {
  products: ["create", "read", "update", "delete"],
  categories: ["create", "read", "update", "delete"],
  pricing: ["read", "update"],
  inventory: ["read", "update"],
  orders: ["read", "create", "update", "cancel", "refund", "delete"],
  payments: ["read", "refund", "update"],
  shipping: ["read", "update"],
  returns: ["read", "update"],
  customers: ["read", "update", "create", "delete"],
  promotions: ["create", "read", "update", "delete"],
  reviews: ["read", "moderate", "delete"],
  cms: ["create", "read", "update", "delete", "publish"],
  markets: ["read", "update"],
  users: ["create", "read", "update", "delete"],
  roles: ["create", "read", "update", "delete", "assign"],
  analytics: ["read"],
  audit: ["read"],
  notifications: ["read", "update"],
};

/// Phase 6E business decision: exactly two roles exist for now —
/// `super_admin` (every permission) and `customer` (none, ownership-based
/// access only). The 7 operational roles seeded through Phase 6D (`admin`,
/// `store_manager`, `product_manager`, `inventory_manager`, `order_manager`,
/// `marketing_manager`, `customer_support`) are deliberately removed, not
/// merely unused — `seedRoles()` below deletes any stale `Role` row whose
/// key isn't in this array. `permissionMatrix` (the resource:action
/// definitions) is untouched: a future operational role is reintroduced
/// later against the same matrix, with only the permissions it actually
/// needs — this array is not the place that decision gets undone.
const roles: {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  allPermissions?: boolean;
  permissions?: string[];
}[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Unrestricted access to every resource. The only administrative role for now.",
    isSystem: true,
    allPermissions: true,
  },
  {
    key: "customer",
    name: "Customer",
    description:
      "Storefront customer. Access to own resources is granted by ownership checks, not admin permissions.",
    isSystem: true,
    permissions: [],
  },
];

async function seedMarkets() {
  for (const market of markets) {
    await prisma.market.upsert({
      where: { code: market.code },
      update: {
        name: market.name,
        currencyCode: market.currencyCode,
        currencyMinorUnits: market.currencyMinorUnits,
        timezone: market.timezone,
      },
      create: market,
    });
  }
  console.log(`Seeded ${markets.length} markets.`);
}

async function seedPermissions() {
  let count = 0;
  for (const [resource, actions] of Object.entries(permissionMatrix)) {
    for (const action of actions) {
      const key = `${resource}:${action}`;
      await prisma.permission.upsert({
        where: { key },
        update: { resource, action },
        create: { key, resource, action },
      });
      count += 1;
    }
  }
  console.log(`Seeded ${count} permissions.`);
}

async function seedRoles() {
  const allPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  for (const role of roles) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: role.isSystem },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      },
    });

    const keys = role.allPermissions ? [...permissionIdByKey.keys()] : (role.permissions ?? []);
    const permissionIds = keys.map((key) => {
      const id = permissionIdByKey.get(key);
      if (!id) {
        throw new Error(`Role ${role.key} references unknown permission: ${key}`);
      }
      return id;
    });

    // Replace the role's permission set so the seed is authoritative and idempotent.
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({
        where: { roleId: record.id, permissionId: { notIn: permissionIds } },
      }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: record.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  }

  // Phase 6E: delete any Role row whose key is no longer in the array above
  // (the 7 operational roles retired this phase). Safe unconditionally —
  // UserRole/RolePermission both cascade on Role delete (no FK restrict,
  // confirmed against schema.prisma), and no real admin user has ever held
  // one of these roles pre-launch, only throwaway test/verification
  // accounts. This is what makes the seed authoritative for role EXISTENCE,
  // not just each kept role's permission set.
  const currentKeys = roles.map((role) => role.key);
  const deleted = await prisma.role.deleteMany({ where: { key: { notIn: currentKeys } } });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} retired role(s) no longer in the seed's role list.`);
  }

  console.log(`Seeded ${roles.length} roles with their permission sets.`);
}

// ShippingMethod has no unique constraint beyond `id`, so a true Prisma
// upsert isn't available — idempotency is achieved with a find-then-create-
// or-update pattern instead, keyed on (marketId, name), same as every other
// seed function here is safe to re-run.
async function seedShippingMethods() {
  const marketByCode = new Map(
    (await prisma.market.findMany({ where: { code: { in: markets.map((m) => m.code) } } })).map((m) => [
      m.code,
      m,
    ])
  );

  let count = 0;
  for (const method of shippingMethods) {
    const market = marketByCode.get(method.marketCode);
    if (!market) {
      throw new Error(`Shipping method references unknown market: ${method.marketCode}`);
    }

    const data = {
      description: method.description,
      baseRate: method.baseRate,
      freeShippingThreshold: method.freeShippingThreshold,
      estimatedMinDays: method.estimatedMinDays,
      estimatedMaxDays: method.estimatedMaxDays,
      isActive: true,
      isPublic: method.isPublic ?? true,
    };

    const existing = await prisma.shippingMethod.findFirst({
      where: { marketId: market.id, name: method.name },
    });

    if (existing) {
      await prisma.shippingMethod.update({ where: { id: existing.id }, data });
    } else {
      await prisma.shippingMethod.create({
        data: { marketId: market.id, name: method.name, ...data },
      });
    }
    count += 1;
  }
  console.log(`Seeded ${count} shipping methods.`);
}

// ---------------------------------------------------------------------------
// Demo catalog — categories, products and reviews for the storefront
// homepage (design-references/Homepage.png). Real Unsplash imagery; no
// schema/business-logic changes, only rows through existing models.
// ---------------------------------------------------------------------------

const demoCategories: { slug: string; name: string; description: string; imageUrl: string; position: number }[] = [
  {
    slug: "shilajit",
    name: "Shilajit",
    description: "Pure, lab-tested Himalayan shilajit resin.",
    imageUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800&q=80",
    position: 0,
  },
  {
    slug: "honey",
    name: "Honey",
    description: "Raw, unfiltered honey from wild hives.",
    imageUrl: "https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800&q=80",
    position: 1,
  },
  {
    slug: "perfumes",
    name: "Perfumes",
    description: "Natural-essence eau de parfum.",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80",
    position: 2,
  },
  {
    slug: "natural-products",
    name: "Natural Products",
    description: "Herbal supplements and wellness essentials.",
    imageUrl: "https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&q=80",
    position: 3,
  },
  {
    slug: "personal-care",
    name: "Personal Care",
    description: "Natural skin and body care.",
    imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80",
    position: 4,
  },
  {
    slug: "new-arrivals",
    name: "New Arrivals",
    description: "The newest additions to the catalog.",
    imageUrl: "https://images.unsplash.com/photo-1509587584298-0f3b3a3a1797?w=800&q=80",
    position: 5,
  },
];

interface DemoProductMarketPricing {
  amount: number; // minor units in that market's currency
  saleAmount?: number;
  onHand: number;
}

interface DemoProduct {
  slug: string;
  name: string;
  shortDescription: string;
  categorySlugs: string[];
  imageUrl: string;
  // Per-market pricing/stock. A market key is present only when the product
  // should be sold there — this is what drives the PK/AE test matrix (see
  // docs/CURRENT_TASK.md): most existing demo products are PK-only (pk set,
  // ae omitted), a few are dual-market with independently-set prices/stock
  // (never derived from one another), and one is AE-exclusive.
  pk?: DemoProductMarketPricing;
  ae?: DemoProductMarketPricing;
}

const demoProducts: DemoProduct[] = [
  {
    // Market matrix "A": PK + AE, independent price and stock per market.
    slug: "himalayan-shilajit-resin",
    name: "Himalayan Shilajit Resin",
    shortDescription: "Authentic, hand-harvested shilajit resin from the Himalayas.",
    categorySlugs: ["shilajit"],
    imageUrl: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=800&q=80",
    pk: { amount: 499900, onHand: 60 },
    ae: { amount: 6500, onHand: 30 },
  },
  {
    // Market matrix "B": PK-only — confirms a PK-only product stays absent
    // from AE listings rather than leaking through with a stale PK price.
    slug: "pure-shilajit-resin",
    name: "Pure Shilajit Resin",
    shortDescription: "Lab-tested purity, no fillers, no shortcuts.",
    categorySlugs: ["shilajit"],
    imageUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80",
    pk: { amount: 599800, saleAmount: 499900, onHand: 45 },
  },
  {
    // Market matrix "D": PK + AE, each market with its own independent sale.
    slug: "raw-wild-honey",
    name: "Raw Wild Honey",
    shortDescription: "Unfiltered, single-origin wild honey.",
    categorySlugs: ["honey"],
    imageUrl: "https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800&q=80",
    pk: { amount: 469900, saleAmount: 369900, onHand: 80 },
    ae: { amount: 4500, saleAmount: 3900, onHand: 25 },
  },
  {
    slug: "ajwa-honey",
    name: "Ajwa Honey",
    shortDescription: "Rich, dark honey infused with Ajwa dates.",
    categorySlugs: ["honey", "new-arrivals"],
    imageUrl: "https://images.unsplash.com/photo-1471943311424-646960669fbc?w=800&q=80",
    pk: { amount: 699900, onHand: 30 },
  },
  {
    slug: "luxury-perfume-for-men",
    name: "Luxury Perfume For Men",
    shortDescription: "Natural-essence eau de parfum, long-lasting.",
    categorySlugs: ["perfumes"],
    imageUrl: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80",
    pk: { amount: 499900, saleAmount: 399900, onHand: 25 },
  },
  {
    slug: "oud-perfume",
    name: "Oud Perfume",
    shortDescription: "Warm, woody oud fragrance.",
    categorySlugs: ["perfumes"],
    imageUrl: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
    pk: { amount: 899900, onHand: 20 },
  },
  {
    slug: "ashwagandha-capsules",
    name: "Ashwagandha Capsules",
    shortDescription: "Standardized-extract ashwagandha for daily stress support.",
    categorySlugs: ["natural-products"],
    imageUrl: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&q=80",
    pk: { amount: 399800, saleAmount: 299900, onHand: 70 },
  },
  {
    slug: "collagen-peptides",
    name: "Collagen Peptides",
    shortDescription: "Hydrolyzed collagen peptides, unflavored.",
    categorySlugs: ["natural-products"],
    imageUrl: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=800&q=80",
    pk: { amount: 349900, onHand: 55 },
  },
  {
    slug: "green-tea-extract",
    name: "Green Tea Extract",
    shortDescription: "Antioxidant-rich green tea extract capsules.",
    categorySlugs: ["natural-products", "new-arrivals"],
    imageUrl: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800&q=80",
    pk: { amount: 299900, onHand: 65 },
  },
  {
    slug: "vitamin-c-serum",
    name: "Vitamin C Serum",
    shortDescription: "Brightening serum with stabilized vitamin C.",
    categorySlugs: ["personal-care"],
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80",
    pk: { amount: 439900, saleAmount: 349900, onHand: 40 },
  },
  {
    slug: "natural-face-cream",
    name: "Natural Face Cream",
    shortDescription: "Lightweight daily moisturizer, plant-derived actives.",
    categorySlugs: ["personal-care", "new-arrivals"],
    imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80",
    pk: { amount: 499800, saleAmount: 399900, onHand: 50 },
  },
  {
    slug: "beard-oil",
    name: "Beard Oil",
    shortDescription: "Nourishing beard oil with natural carrier oils.",
    categorySlugs: ["personal-care"],
    imageUrl: "https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80",
    pk: { amount: 299900, onHand: 35 },
  },
  {
    // Market matrix "C": AE-only — confirms an AE-exclusive product stays
    // absent from PK listings.
    slug: "shilajit-gold-reserve",
    name: "Shilajit Gold Reserve",
    shortDescription: "Premium small-batch reserve, UAE exclusive.",
    categorySlugs: ["shilajit"],
    imageUrl: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80",
    ae: { amount: 12000, onHand: 15 },
  },
];

interface DemoReviewer {
  email: string;
  firstName: string;
  lastName: string;
  location: string;
  avatarUrl: string;
}

const demoReviewers: DemoReviewer[] = [
  {
    email: "ahmed.raza@demo.vizauraglobal.test",
    firstName: "Ahmed",
    lastName: "Raza",
    location: "Lahore, PK",
    avatarUrl: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&q=80",
  },
  {
    email: "fatima.khan@demo.vizauraglobal.test",
    firstName: "Fatima",
    lastName: "Khan",
    location: "Karachi, PK",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80",
  },
  {
    email: "omar.alsuwaidi@demo.vizauraglobal.test",
    firstName: "Omar",
    lastName: "Al Suwaidi",
    location: "Dubai, UAE",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80",
  },
];

// One featured testimonial per reviewer (homepage "What Our Customers Say"),
// each attached to a different seeded product so it also counts toward that
// product's rating aggregate.
const featuredReviews: { reviewerIndex: number; productSlug: string; rating: number; body: string }[] = [
  {
    reviewerIndex: 0,
    productSlug: "pure-shilajit-resin",
    rating: 5,
    body: "Amazing quality! The shilajit is authentic and really makes a difference in my energy levels.",
  },
  {
    reviewerIndex: 1,
    productSlug: "raw-wild-honey",
    rating: 5,
    body: "The honey is pure and has such a great taste. Highly recommended!",
  },
  {
    reviewerIndex: 2,
    productSlug: "oud-perfume",
    rating: 5,
    body: "Fast delivery to UAE and excellent packaging. Will definitely order again.",
  },
];

// A couple of extra, non-featured reviews per popular product so rating
// aggregates aren't all based on a single review.
const extraReviews: { reviewerIndex: number; productSlug: string; rating: number; body: string }[] = [
  {
    reviewerIndex: 1,
    productSlug: "pure-shilajit-resin",
    rating: 4,
    body: "Good product, noticed a difference after a couple of weeks.",
  },
  {
    reviewerIndex: 2,
    productSlug: "raw-wild-honey",
    rating: 4,
    body: "Great taste, will buy again.",
  },
  {
    reviewerIndex: 0,
    productSlug: "ashwagandha-capsules",
    rating: 5,
    body: "Easy to take daily and I sleep better since starting these.",
  },
];

// Phase 6K: demo reviews for every product that previously had none, so the
// storefront never shows an empty review tab on a product someone is
// actually browsing in a demo/dev environment. Every entry here is written
// as SEED content in seedDemoReviews() below — product-specific, varied in
// length/rating/wording (never the generic "Great product!" boilerplate),
// but explicitly never a stand-in for a real verified customer.
const additionalSeedReviews: { reviewerIndex: number; productSlug: string; rating: number; title?: string; body: string }[] = [
  {
    reviewerIndex: 1,
    productSlug: "himalayan-shilajit-resin",
    rating: 5,
    title: "Noticeably more energy",
    body: "I was skeptical about shilajit but this one changed my mind. The resin is soft and dissolves easily in warm milk, and within two weeks I was waking up without needing three cups of chai to function. The earthy taste takes getting used to.",
  },
  {
    reviewerIndex: 2,
    productSlug: "himalayan-shilajit-resin",
    rating: 4,
    body: "Good texture and it dissolves fast. Packaging could be sturdier for shipping to Dubai — mine arrived slightly squished but the product itself was fine.",
  },
  {
    reviewerIndex: 0,
    productSlug: "himalayan-shilajit-resin",
    rating: 4,
    body: "Authentic smell and consistency, similar to what my uncle used to bring back from the north. A bit pricey but worth it for the quality.",
  },
  {
    reviewerIndex: 0,
    productSlug: "ajwa-honey",
    rating: 5,
    title: "Rich and not overly sweet",
    body: "You can really taste the dates in this — it's darker and more complex than regular honey. We use it on paratha every morning now and a jar lasts about three weeks for a family of four.",
  },
  {
    reviewerIndex: 1,
    productSlug: "ajwa-honey",
    rating: 4,
    body: "Thicker consistency than I expected, almost like a spread. Great flavor but crystallizes a bit faster than other honey I've bought.",
  },
  {
    reviewerIndex: 2,
    productSlug: "ajwa-honey",
    rating: 5,
    body: "Bought this as a gift and ended up ordering a second jar for myself. Genuinely different from supermarket honey.",
  },
  {
    reviewerIndex: 2,
    productSlug: "luxury-perfume-for-men",
    rating: 5,
    title: "Lasts all day",
    body: "Sprayed this at 8am for a work event and could still smell it faintly at 9pm without reapplying. Not overpowering up close, but has a good projection from a distance. Will be my go-to for formal occasions.",
  },
  {
    reviewerIndex: 0,
    productSlug: "luxury-perfume-for-men",
    rating: 4,
    body: "Nice warm scent, opens a bit sharp for the first ten minutes then settles into something much smoother. Bottle design feels premium too.",
  },
  {
    reviewerIndex: 1,
    productSlug: "luxury-perfume-for-men",
    rating: 3,
    body: "Smells good but didn't last as long on my skin as I'd hoped — maybe 4-5 hours before it faded to almost nothing. Might just be my skin chemistry.",
  },
  {
    reviewerIndex: 1,
    productSlug: "collagen-peptides",
    rating: 4,
    title: "Dissolves cleanly, no taste",
    body: "Mixes into my morning coffee without any grit or weird aftertaste, which is more than I can say for other brands I've tried. Three months in and my nails are noticeably less brittle.",
  },
  {
    reviewerIndex: 2,
    productSlug: "collagen-peptides",
    rating: 5,
    body: "Unflavored actually means unflavored here — doesn't clash when I add it to smoothies. Easy 5 stars for that alone.",
  },
  {
    reviewerIndex: 0,
    productSlug: "green-tea-extract",
    rating: 4,
    body: "Capsules are easy to swallow and don't have that bitter green tea aftertaste you get from brewing it yourself. Been taking one with breakfast for about a month.",
  },
  {
    reviewerIndex: 1,
    productSlug: "green-tea-extract",
    rating: 5,
    title: "Good energy without the jitters",
    body: "I'm sensitive to caffeine and these give a gentle lift without the crash I get from coffee. Paired with my morning walk it's been a nice addition to the routine.",
  },
  {
    reviewerIndex: 2,
    productSlug: "vitamin-c-serum",
    rating: 5,
    title: "Visible brightening in two weeks",
    body: "My under-eye area looked noticeably less dull after about ten days of using this morning and night. Absorbs quickly, doesn't pill under makeup, and no stinging even on sensitive skin like mine.",
  },
  {
    reviewerIndex: 0,
    productSlug: "vitamin-c-serum",
    rating: 4,
    body: "Lightweight texture, layers well under moisturizer. Slight citrus smell that fades fast. Would like a smaller travel size option.",
  },
  {
    reviewerIndex: 1,
    productSlug: "natural-face-cream",
    rating: 5,
    body: "Finally a moisturizer that doesn't leave a greasy film in Karachi humidity. Sinks in within a minute and my makeup sits better on top of it.",
  },
  {
    reviewerIndex: 2,
    productSlug: "natural-face-cream",
    rating: 4,
    title: "Good for combination skin",
    body: "Hydrates my dry cheeks without making my T-zone oilier by midday. A little goes a long way — one pump covers my whole face.",
  },
  {
    reviewerIndex: 0,
    productSlug: "beard-oil",
    rating: 5,
    body: "Non-greasy and the scent is subtle enough to wear to work without it being distracting. My beard has looked noticeably softer and less patchy-looking after about a month of daily use.",
  },
  {
    reviewerIndex: 1,
    productSlug: "beard-oil",
    rating: 4,
    body: "A few drops massaged in after showering works well. Bottle dropper could dispense a bit more consistently, but the oil itself is good quality.",
  },
  {
    reviewerIndex: 2,
    productSlug: "shilajit-gold-reserve",
    rating: 5,
    title: "Premium quality, worth the price",
    body: "Ordered this for my father in Dubai and he says it's noticeably purer and smoother in texture than the shilajit he used to get locally. Small batch size but a little clearly goes further than cheaper alternatives.",
  },
  {
    reviewerIndex: 0,
    productSlug: "shilajit-gold-reserve",
    rating: 4,
    body: "Good resin consistency, dissolves fully with no grit left behind. Pricier than other shilajit but the purity testing info included gave me confidence in it.",
  },
];

async function seedDemoCategories(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const category of demoCategories) {
    // Find-then-create-if-missing, not upsert-with-update: a category's
    // name/description/imageUrl are admin-editable after seeding (the admin
    // dashboard is the real source of truth for them), so re-running this
    // script must never reset an already-seeded row back to its demo
    // values — that silently clobbered real admin-uploaded category images.
    // Same idiom as ProductVariant/VariantPrice/VariantStock below.
    let record = await prisma.category.findUnique({ where: { slug: category.slug } });
    record ??= await prisma.category.create({ data: category });
    idBySlug.set(category.slug, record.id);
  }
  console.log(`Seeded ${demoCategories.length} categories.`);
  return idBySlug;
}

async function seedDemoProducts(categoryIdBySlug: Map<string, string>): Promise<Map<string, { productId: string; variantId: string }>> {
  const marketsByCode = {
    PK: await prisma.market.findUniqueOrThrow({ where: { code: "PK" } }),
    AE: await prisma.market.findUniqueOrThrow({ where: { code: "AE" } }),
  };
  const idsBySlug = new Map<string, { productId: string; variantId: string }>();

  for (const demo of demoProducts) {
    const product = await prisma.product.upsert({
      where: { slug: demo.slug },
      update: { name: demo.name, shortDescription: demo.shortDescription, status: "ACTIVE" },
      create: { slug: demo.slug, name: demo.name, shortDescription: demo.shortDescription, status: "ACTIVE" },
    });

    let variant = await prisma.productVariant.findFirst({ where: { productId: product.id, isDefault: true } });
    variant ??= await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `${demo.slug}-default`.toUpperCase(),
        title: "Default",
        isDefault: true,
      },
    });

    // Per-market price/stock/availability — only for markets this product
    // defines (demo.pk / demo.ae), so PK-only and AE-only products in the
    // test matrix genuinely have zero rows in the other market rather than
    // an implicit/derived one.
    for (const [code, pricing] of Object.entries({ PK: demo.pk, AE: demo.ae }) as ["PK" | "AE", DemoProductMarketPricing | undefined][]) {
      if (!pricing) continue;
      const market = marketsByCode[code];

      const existingPrice = await prisma.variantPrice.findUnique({
        where: { variantId_marketId: { variantId: variant.id, marketId: market.id } },
      });
      if (!existingPrice) {
        await prisma.variantPrice.create({
          data: {
            variantId: variant.id,
            marketId: market.id,
            currencyCode: market.currencyCode,
            amount: pricing.amount,
            saleAmount: pricing.saleAmount ?? null,
          },
        });
      }

      const existingStock = await prisma.variantStock.findUnique({
        where: { variantId_marketId: { variantId: variant.id, marketId: market.id } },
      });
      if (!existingStock) {
        await prisma.variantStock.create({
          data: { variantId: variant.id, marketId: market.id, onHand: pricing.onHand },
        });
      }

      const existingMarket = await prisma.productMarket.findUnique({
        where: { productId_marketId: { productId: product.id, marketId: market.id } },
      });
      if (!existingMarket) {
        await prisma.productMarket.create({
          data: { productId: product.id, marketId: market.id, isAvailable: true, isVisible: true },
        });
      }
    }

    const existingMedia = await prisma.productMedia.findFirst({ where: { productId: product.id, isPrimary: true } });
    if (existingMedia) {
      if (existingMedia.url !== demo.imageUrl) {
        await prisma.productMedia.update({ where: { id: existingMedia.id }, data: { url: demo.imageUrl, altText: demo.name } });
      }
    } else {
      await prisma.productMedia.create({
        data: { productId: product.id, url: demo.imageUrl, altText: demo.name, isPrimary: true },
      });
    }

    for (const categorySlug of demo.categorySlugs) {
      const categoryId = categoryIdBySlug.get(categorySlug);
      if (!categoryId) throw new Error(`Product ${demo.slug} references unknown category: ${categorySlug}`);
      const existingLink = await prisma.productCategory.findUnique({
        where: { productId_categoryId: { productId: product.id, categoryId } },
      });
      if (!existingLink) {
        await prisma.productCategory.create({ data: { productId: product.id, categoryId } });
      }
    }

    idsBySlug.set(demo.slug, { productId: product.id, variantId: variant.id });
  }

  console.log(`Seeded ${demoProducts.length} demo products.`);
  return idsBySlug;
}

async function seedDemoReviewers(): Promise<string[]> {
  const userIds: string[] = [];
  for (const reviewer of demoReviewers) {
    const user = await prisma.user.upsert({
      where: { email: reviewer.email },
      update: { firstName: reviewer.firstName, lastName: reviewer.lastName },
      create: {
        email: reviewer.email,
        passwordHash: DUMMY_PASSWORD_HASH,
        firstName: reviewer.firstName,
        lastName: reviewer.lastName,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);
  }
  console.log(`Seeded ${demoReviewers.length} demo review authors.`);
  return userIds;
}

async function seedDemoReviews(
  reviewerUserIds: string[],
  productIdsBySlug: Map<string, { productId: string; variantId: string }>
) {
  const entries = [
    ...featuredReviews.map((r) => ({ ...r, title: undefined as string | undefined, isFeatured: true })),
    ...extraReviews.map((r) => ({ ...r, title: undefined as string | undefined, isFeatured: false })),
    ...additionalSeedReviews.map((r) => ({ ...r, isFeatured: false })),
  ];

  let count = 0;
  for (const entry of entries) {
    const reviewer = demoReviewers[entry.reviewerIndex];
    const userId = reviewerUserIds[entry.reviewerIndex];
    const product = productIdsBySlug.get(entry.productSlug);
    if (!reviewer || !userId || !product) {
      throw new Error(`Review references unknown reviewer/product: ${entry.productSlug}`);
    }

    // All rows seeded here are demo/development content, never a stand-in
    // for a genuine customer submission — source: SEED and
    // isVerifiedPurchase: false are stamped explicitly on every upsert
    // (both branches) so they're never misrepresented as verified real
    // customer reviews, regardless of the schema's CUSTOMER default.
    await prisma.review.upsert({
      where: { productId_userId: { productId: product.productId, userId } },
      update: {
        rating: entry.rating,
        title: entry.title ?? null,
        body: entry.body,
        isFeatured: entry.isFeatured,
        authorName: `${reviewer.firstName} ${reviewer.lastName}`,
        authorLocation: reviewer.location,
        avatarUrl: reviewer.avatarUrl,
        source: "SEED",
        isVerifiedPurchase: false,
      },
      create: {
        productId: product.productId,
        userId,
        rating: entry.rating,
        title: entry.title ?? null,
        body: entry.body,
        isFeatured: entry.isFeatured,
        authorName: `${reviewer.firstName} ${reviewer.lastName}`,
        authorLocation: reviewer.location,
        avatarUrl: reviewer.avatarUrl,
        source: "SEED",
        isVerifiedPurchase: false,
      },
    });
    count += 1;
  }
  console.log(`Seeded ${count} demo reviews.`);
}

// Demo data (fake products, fake review authors with working dummy-hash
// passwords, fake reviews) must never silently seed into a production
// database. Bootstrap data (markets/permissions/roles/shipping methods) is
// reference data a real deployment needs and always runs, in any
// environment. This is a lightweight guard scoped to Phase 6C — a fuller
// production-seed-safety system (e.g. splitting demo data into its own
// script, excluding seed.ts from prod deploy pipelines entirely) is
// deferred to a later phase; see docs/MODULE_STATUS.md.
const isProduction = process.env.NODE_ENV === "production";
const allowDemoSeed = process.env.SEED_ALLOW_DEMO_DATA === "true";

async function main() {
  await seedMarkets();
  await seedPermissions();
  await seedRoles();
  await seedShippingMethods();

  if (isProduction && !allowDemoSeed) {
    console.log(
      'Skipping demo catalog/review seed data (NODE_ENV=production, SEED_ALLOW_DEMO_DATA not set to "true").',
    );
    return;
  }

  const categoryIdBySlug = await seedDemoCategories();
  const productIdsBySlug = await seedDemoProducts(categoryIdBySlug);
  const reviewerUserIds = await seedDemoReviewers();
  await seedDemoReviews(reviewerUserIds, productIdsBySlug);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
