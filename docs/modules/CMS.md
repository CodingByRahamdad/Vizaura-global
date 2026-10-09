# CMS Module

**Purpose:** Manage editorial/content pages (blog, landing content, static pages) independent of the product catalog.

**Responsibilities:** Content page/post CRUD, publishing workflow, market-specific content variants.

**Data ownership:** Page, Post, ContentBlock tables.

**Main entities:** Page, Post, ContentBlock.

**API boundary:** `/api/v1/admin/*` for management, public read endpoints TBD at implementation (e.g. under a `/content` or storefront-facing path).

**Dependencies:** Markets (market-specific content), Users (authorship).

**Security considerations:** Write operations permission-gated (`cms:create/update/delete`); published content sanitized to prevent stored XSS.

**Current status:** NOT STARTED

**Future notes:** N/A.
