# PROMOTIONS Module

**Purpose:** Own discounts, coupons, and promotional rules, configurable per market.

**Responsibilities:** Promotion/coupon definition, eligibility rules, application at cart/checkout.

**Data ownership:** Promotion, Coupon, PromotionRule tables.

**Main entities:** Promotion, Coupon, PromotionRule.

**API boundary:** `/api/v1/promotions/*`

**Dependencies:** Markets (market-specific promotions), Cart/Checkout (application and re-validation), Catalog (product/category eligibility).

**Security considerations:** Discount eligibility and amount are always re-validated server-side at checkout — never trusted from the client.

**Current status:** NOT STARTED

**Future notes:** N/A.
