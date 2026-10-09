-- Defense in depth: an ADMIN/SEED-sourced review must never be flagged as
-- a verified purchase. This mirrors the rule enforced in the service layer
-- (ReviewsService.adminCreate/adminUpdate always force isVerifiedPurchase
-- to false for non-CUSTOMER sources) at the database level too.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_verified_purchase_requires_customer_source"
  CHECK (NOT "isVerifiedPurchase" OR "source" = 'CUSTOMER');
