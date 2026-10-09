# NOTIFICATIONS Module

**Purpose:** Send transactional and lifecycle notifications (email, and later SMS/push) to customers and staff.

**Responsibilities:** Templated notification dispatch (e.g. email verification, password reset, order confirmation, shipment updates), delivery tracking.

**Data ownership:** NotificationTemplate, NotificationRecord tables.

**Main entities:** NotificationTemplate, NotificationRecord.

**API boundary:** `/api/v1/notifications/*` (mostly triggered internally by other domains rather than called directly by the frontend).

**Dependencies:** Auth (verification/reset), Orders/Shipping (status updates), external email/SMS provider (accessed through a provider abstraction — no specific provider chosen in this foundation task).

**Security considerations:** Notification content never includes secrets/tokens beyond the single-use link required; provider credentials stay server-side.

**Current status:** NOT STARTED

**Future notes:** SMS/push channels are future additions beyond MVP email.
