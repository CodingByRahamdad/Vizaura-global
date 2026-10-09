# CUSTOMERS Module

**Purpose:** Own customer-specific profile data (as distinct from the generic User identity).

**Responsibilities:** Customer profile, saved addresses, order/wishlist/review relationships (referenced, not owned here).

**Data ownership:** Customer, Address tables.

**Main entities:** Customer, Address.

**API boundary:** `/api/v1/customers/*`

**Dependencies:** Users (base identity), Orders/Wishlist/Reviews (owned resources referencing customerId).

**Security considerations:** A customer may only read/update their own profile and addresses; staff access is permission-gated (`customers:read`).

**Current status:** NOT STARTED

**Future notes:** N/A.
