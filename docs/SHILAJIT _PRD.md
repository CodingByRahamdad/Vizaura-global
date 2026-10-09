# **Phase 1 — Product Requirements Document (PRD)**

Below is the **complete PRD** for the e-commerce platform, based on your uploaded requirements. I’ve structured it so it can later become the foundation for the architecture, database design, UX/UI, and Claude Code development workflow.

---

# **1\. Document Overview**

| Field | Specification |
| ----- | ----- |
| Product | Premium Natural & Lifestyle E-Commerce Platform |
| Markets | Pakistan 🇵🇰 and UAE 🇦🇪 |
| Primary Technology | Next.js \+ TypeScript \+ React |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM | Prisma |
| Architecture | Modular, scalable, production-grade |
| Authentication | Secure authentication \+ RBAC |
| Primary Coding Assistant | Claude Code |
| Initial Scope | Pakistan \+ UAE |
| Future Scope | Additional countries/markets |

### **Document Purpose**

This PRD defines the business, product, functional, operational, UX, technical, security, and scalability requirements for a production-grade e-commerce platform selling natural, premium, and lifestyle products.

The system must be designed as a **commercially usable platform**, rather than a basic CRUD shopping application.

---

# **2\. Product Vision**

Build a premium, scalable e-commerce platform that allows customers in **Pakistan and the UAE** to discover, purchase, and track natural and lifestyle products through a modern storefront while providing administrators with comprehensive control over products, inventory, orders, customers, marketing, payments, shipping, and analytics.

The architecture should allow additional markets to be introduced later without requiring major restructuring.

---

# **3\. Business Objectives**

### **Primary Objectives**

1. Sell products online in Pakistan and UAE.  
2. Provide independent market-specific pricing.  
3. Provide market-specific product availability.  
4. Support different payment and shipping methods per market.  
5. Provide a premium customer shopping experience.  
6. Provide efficient administration and order management.  
7. Establish a scalable technical foundation.  
8. Optimize the platform for SEO and performance.  
9. Maintain strong security and access control.  
10. Build a foundation that can support additional markets.

### **Business Success Criteria**

The platform should enable the business to:

* Increase online sales.  
* Expand into multiple markets.  
* Reduce manual order processing.  
* Improve inventory visibility.  
* Improve customer retention.  
* Track business performance.  
* Run targeted promotions.  
* Scale product/catalog size.  
* Add payment/shipping providers without major redevelopment.

---

# **4\. Target Markets**

## **4.1 Pakistan**

Primary currency:

**PKR**

Potential payment methods:

* Cash on Delivery  
* Local payment gateways  
* Bank/payment integrations

Shipping:

* Domestic shipping  
* Multiple shipping methods  
* Configurable delivery charges  
* Free-shipping thresholds

---

## **4.2 UAE**

Primary currency:

**AED**

Potential payment methods:

* Card payments  
* UAE-compatible gateways  
* Cash on Delivery where required

Shipping:

* UAE domestic shipping  
* Configurable zones  
* Multiple delivery methods  
* Delivery estimates

---

# **5\. Critical Market Architecture Requirement**

The platform must **not treat Pakistan and UAE as simple currency conversions**.

Each market has independent commercial configuration.

Example:

| Product | Pakistan | UAE |
| ----- | ----- | ----- |
| Shilajit 20g | PKR 4,999 | AED 149 |
| Honey 500g | PKR 2,500 | AED 75 |

The admin must be able to independently configure:

* Price  
* Sale price  
* Availability  
* Visibility  
* Promotions  
* Shipping  
* Tax  
* Payment methods  
* Market-specific content

### **Exchange Rates**

Exchange rates may exist separately for:

* Reporting  
* Analytics  
* Financial comparison  
* Administrative dashboards

Exchange rates **must not automatically determine storefront prices**.

---

# **6\. Target Users**

## **6.1 Customer**

Customers browse and purchase products.

Capabilities:

* Browse products  
* Search  
* Filter  
* Add to cart  
* Checkout  
* Make payment  
* Track orders  
* Manage profile  
* Manage addresses  
* Review products  
* Wishlist products

---

## **6.2 Super Admin**

Full system control.

Responsibilities:

* System configuration  
* Users  
* Roles  
* Permissions  
* Markets  
* Products  
* Orders  
* Inventory  
* Payments  
* Shipping  
* Promotions  
* Analytics  
* Content  
* Audit logs

---

## **6.3 Admin**

General operational administration.

---

## **6.4 Store Manager**

Responsible for operational/store management.

---

## **6.5 Product Manager**

Responsible for:

* Products  
* Categories  
* Product content  
* Pricing  
* Product SEO  
* Product availability

---

## **6.6 Inventory Manager**

Responsible for:

* Stock  
* Inventory adjustments  
* Low-stock management  
* Inventory history

---

## **6.7 Order Manager**

Responsible for:

* Orders  
* Order processing  
* Shipment processing  
* Returns/refunds

---

## **6.8 Marketing Manager**

Responsible for:

* Coupons  
* Promotions  
* Campaigns  
* Featured products  
* Promotional content

---

## **6.9 Customer Support**

Responsible for:

* Customer information  
* Orders  
* Customer communication  
* Order support

---

# **7\. User Personas**

### **Persona A — Online Customer**

Needs:

* Fast product discovery  
* Clear pricing  
* Trustworthy product information  
* Simple checkout  
* Multiple payment options  
* Order tracking

### **Persona B — Returning Customer**

Needs:

* Fast checkout  
* Saved addresses  
* Order history  
* Wishlist  
* Personalized/recommended products

### **Persona C — Administrator**

Needs:

* Centralized business control  
* Clear dashboards  
* Efficient workflows  
* Auditability  
* Operational reporting

### **Persona D — Inventory Manager**

Needs:

* Accurate stock  
* Low-stock alerts  
* Inventory history  
* SKU management

---

# **8\. Core Customer Journey**

Visit Website  
     ↓  
Select Market  
     ↓  
Browse Homepage  
     ↓  
Category / Search  
     ↓  
Product Listing  
     ↓  
Product Details  
     ↓  
Select Variant  
     ↓  
Add to Cart  
     ↓  
Review Cart  
     ↓  
Checkout  
     ↓  
Address  
     ↓  
Shipping Method  
     ↓  
Payment Method  
     ↓  
Order Confirmation  
     ↓  
Order Processing  
     ↓  
Shipment  
     ↓  
Delivery  
     ↓  
Review  
---

# **9\. Market Selection Journey**

Customer enters the website.

Website  
   ↓  
Determine Market  
   ↓  
Pakistan / UAE  
   ↓  
Load Market Configuration  
   ↓  
Currency  
Pricing  
Products  
Shipping  
Payment  
Promotions  
Content

The selected market should persist appropriately across the customer's session.

---

# **10\. Storefront Requirements**

## **10.1 Homepage**

The homepage should support:

* Hero banner  
* Promotional campaigns  
* Featured products  
* New arrivals  
* Best sellers  
* Top-rated products  
* Deals  
* Categories  
* Marketing sections  
* Announcements  
* Recommended products  
* Brand/value propositions

Content should support market-specific configuration.

---

# **11\. Product Catalog**

Products should support:

* Product name  
* Slug  
* Description  
* Short description  
* SKU  
* Brand  
* Category  
* Subcategory  
* Images  
* Videos where appropriate  
* Specifications  
* Variants  
* Attributes  
* Ingredients where applicable  
* Product information  
* SEO metadata  
* Product status

---

# **12\. Product Variants**

Products may contain variants such as:

* Size  
* Weight  
* Quantity  
* Fragrance  
* Color  
* Packaging

Each variant should have its own:

* SKU  
* Inventory  
* Attributes  
* Pricing configuration where required

---

# **13\. Product Pricing**

Pricing must support market-specific configuration.

Example:

Product  
 ├── Pakistan  
 │    ├── Price  
 │    └── Sale Price  
 │  
 └── UAE  
      ├── Price  
      └── Sale Price

Pricing should also account for:

* Promotions  
* Coupons  
* Discounts  
* Scheduled campaigns

The final price shown to the customer must be deterministically calculated.

---

# **14\. Product Availability**

Products can be:

* Active  
* Draft  
* Archived  
* Out of stock  
* Temporarily unavailable

Availability can differ by market.

Example:

Shilajit  
Pakistan → Available  
UAE → Available

Product X  
Pakistan → Available  
UAE → Unavailable  
---

# **15\. Product Listing**

Product listing pages should support:

### **Filtering**

Potential filters:

* Category  
* Subcategory  
* Brand  
* Price  
* Rating  
* Availability  
* Attributes  
* Product type  
* Promotions

### **Sorting**

* Relevance  
* Newest  
* Price low → high  
* Price high → low  
* Rating  
* Best selling

### **Pagination**

Use efficient pagination rather than loading the entire catalog.

---

# **16\. Search**

Search should support:

* Product names  
* SKU  
* Categories  
* Relevant product attributes  
* Search suggestions  
* Search result ranking

Future enhancements may include:

* Typo tolerance  
* Synonyms  
* Semantic search  
* Search analytics

---

# **17\. Shopping Cart**

Cart functionality:

* Add product  
* Remove product  
* Change quantity  
* Variant selection  
* Price calculation  
* Discount calculation  
* Shipping estimate  
* Stock validation  
* Market validation

The server must revalidate:

* Product availability  
* Price  
* Inventory  
* Discounts

before order creation.

---

# **18\. Wishlist**

Customers can:

* Add products  
* Remove products  
* View wishlist  
* Move products to cart

Wishlist data should belong to the authenticated customer.

---

# **19\. Recently Viewed**

The system may track recently viewed products.

Implementation can initially use client-side/browser storage with server persistence considered for authenticated customers.

---

# **20\. Checkout**

Checkout should minimize friction.

Required stages:

Cart  
 ↓  
Address  
 ↓  
Shipping  
 ↓  
Payment  
 ↓  
Review  
 ↓  
Order

Checkout should display:

* Products  
* Quantities  
* Prices  
* Discount  
* Shipping fee  
* Tax where applicable  
* Final total

---

# **21\. Customer Accounts**

Customer dashboard should provide:

* Profile  
* Addresses  
* Orders  
* Order details  
* Wishlist  
* Notifications  
* Password management  
* Account settings

---

# **22\. Order Management**

Order lifecycle:

Pending  
 ↓  
Confirmed  
 ↓  
Processing  
 ↓  
Shipped  
 ↓  
Delivered

Alternative states:

* Cancelled  
* Failed  
* Refunded  
* Returned

The exact lifecycle should be finalized during architecture design.

---

# **23\. Order Requirements**

Orders should store immutable commercial information.

An order should preserve:

* Product  
* Variant  
* SKU  
* Quantity  
* Unit price  
* Discount  
* Tax  
* Shipping  
* Total  
* Market  
* Currency

Historical order data should not change merely because the current product price changes.

---

# **24\. Payments**

Payment architecture must use an abstraction layer.

Conceptually:

Order  
 ↓  
Payment Service  
 ↓  
Payment Provider

This allows multiple providers.

Potential statuses:

* Pending  
* Authorized  
* Paid  
* Failed  
* Cancelled  
* Refunded  
* Partially refunded

### **Security**

Never store:

* Card number  
* CVV  
* Sensitive payment credentials

unless handled by an appropriately compliant payment provider/tokenization system.

---

# **25\. Cash on Delivery**

COD should be configurable by market.

Example:

Pakistan → Enabled  
UAE → Enabled

or:

Pakistan → Enabled  
UAE → Disabled

The system should support configurable COD rules.

---

# **26\. Shipping Architecture**

Shipping should be configuration-driven.

Entities should support:

* Markets  
* Shipping zones  
* Shipping methods  
* Rates  
* Delivery estimates  
* Free-shipping thresholds

Example:

Pakistan  
 ├── Lahore  
 ├── Karachi  
 ├── Islamabad  
 └── Other Areas

UAE can similarly contain configurable zones.

---

# **27\. Free Shipping**

Support:

Order \>= threshold  
        ↓  
Free Shipping

Thresholds may differ by market.

Example:

Pakistan → PKR threshold  
UAE → AED threshold  
---

# **28\. Promotions**

Promotion engine should support:

* Percentage discounts  
* Fixed discounts  
* Product discounts  
* Category discounts  
* Market-specific discounts  
* Minimum order discounts  
* Buy X Get Y  
* Free shipping  
* Scheduled promotions

Promotions should have:

* Start date  
* End date  
* Status  
* Eligibility rules  
* Usage limits where applicable

---

# **29\. Coupons**

Coupon functionality:

* Coupon code  
* Discount type  
* Discount amount  
* Market  
* Minimum order  
* Maximum discount  
* Usage limit  
* Per-customer limit  
* Start/end date  
* Applicable products/categories

---

# **30\. Reviews & Ratings**

Customers should be able to:

* Rate products  
* Write reviews  
* Edit/delete their review where business rules allow

Admin should be able to:

* View reviews  
* Moderate reviews  
* Hide/remove inappropriate reviews

Potential future feature:

**Verified Purchase** badge.

---

# **31\. Customer Notifications**

Notifications may include:

* Order confirmation  
* Payment confirmation  
* Order processing  
* Shipment notification  
* Delivery notification  
* Promotional campaigns  
* Review requests

Channels:

* Email  
* In-app

Future:

* SMS  
* WhatsApp

---

# **32\. Admin Dashboard**

The dashboard should provide operational visibility.

Primary dashboard metrics:

* Revenue  
* Orders  
* Customers  
* Average order value  
* Top products  
* Low-stock products  
* Sales by market  
* Recent orders  
* Revenue trends

---

# **33\. Product Administration**

Admin capabilities:

* Create  
* Read  
* Update  
* Archive  
* Restore

Product management should support:

* Images  
* Categories  
* Variants  
* SKUs  
* Pricing  
* Inventory  
* SEO  
* Market availability

---

# **34\. Inventory**

Inventory functionality:

* Current stock  
* Stock adjustment  
* Stock movement history  
* Low-stock threshold  
* Out-of-stock state  
* SKU management  
* Inventory reports

Possible inventory movements:

Purchase  
Adjustment \+  
Adjustment \-  
Sale  
Return  
Damage  
Transfer  
---

# **35\. Warehouses**

The database should allow warehouses to be introduced.

A warehouse may belong to a market or operational region.

Future architecture should support multiple inventory locations without requiring a redesign.

---

# **36\. Customers**

Admin customer management:

* Customer list  
* Profile  
* Orders  
* Addresses  
* Activity  
* Segmentation

Potential future segmentation:

* New customers  
* Returning customers  
* High-value customers  
* Inactive customers

---

# **37\. RBAC**

Authorization must be permission-driven.

Example permissions:

products:create  
products:read  
products:update  
products:delete

orders:read  
orders:update

inventory:read  
inventory:update

customers:read

promotions:create  
promotions:update

Roles are collections of permissions.

Role  
 ↓  
Permissions

rather than:

if user.role \=== "admin"

throughout the codebase.

---

# **38\. Audit Logging**

Important administrative actions should be logged.

Examples:

* Product creation  
* Product update  
* Product deletion/archive  
* Price changes  
* Inventory adjustments  
* Order modifications  
* Refunds  
* User changes  
* Role changes  
* Permission changes  
* Promotion changes

Audit entries should contain appropriate contextual information such as:

* Actor  
* Action  
* Entity  
* Timestamp  
* Relevant before/after information where appropriate

---

# **39\. Content Management**

Admin should manage:

* Homepage banners  
* Promotional sections  
* Featured products  
* Categories  
* Announcements  
* FAQs  
* Marketing sections

Future:

* Blog  
* Articles  
* Landing pages

---

# **40\. SEO Requirements**

Storefront should implement:

* SEO-friendly URLs  
* Dynamic metadata  
* Product metadata  
* Category metadata  
* Open Graph  
* Canonical URLs  
* Sitemap  
* Robots.txt  
* Structured data  
* Product schema  
* Breadcrumb schema  
* Proper heading hierarchy

Product pages should be indexable where appropriate.

---

# **41\. Performance Requirements**

The application should prioritize:

### **Next.js**

* Server Components  
* SSR where appropriate  
* Static generation where appropriate  
* Streaming where useful  
* Metadata generation

### **Database**

* Proper indexes  
* Efficient queries  
* Pagination  
* Avoid N+1 queries

### **Frontend**

* Image optimization  
* Lazy loading  
* Code splitting  
* Minimal JavaScript  
* Avoid unnecessary client components

---

# **42\. Accessibility**

The storefront should target modern accessibility standards.

Consider:

* Keyboard navigation  
* Semantic HTML  
* Accessible forms  
* Focus management  
* Screen-reader compatibility  
* Color contrast  
* Accessible error messages

---

# **43\. Security Requirements**

Security controls include:

### **Authentication**

* Secure password hashing  
* Email verification  
* Password reset  
* Session management

### **Authorization**

* RBAC  
* Permission checks  
* Resource-level authorization

### **Application Security**

* Input validation  
* XSS mitigation  
* CSRF protection where applicable  
* SQL injection protection  
* Rate limiting  
* Secure cookies  
* Secure headers  
* File upload validation

### **Secrets**

Secrets must remain server-side.

---

# **44\. API Requirements**

The API architecture should be:

* Versionable  
* Type-safe  
* Validated  
* Authorized  
* Consistent

Potential domains:

/auth  
/products  
/categories  
/cart  
/checkout  
/orders  
/payments  
/shipping  
/customers  
/reviews  
/wishlist  
/promotions  
/inventory  
/admin  
/analytics  
/notifications

The final API architecture will be defined in Phase 2\.

---

# **45\. Database Requirements**

PostgreSQL should be designed around business domains rather than UI screens.

Core entities may include:

User  
Role  
Permission  
RolePermission  
UserRole

Market  
Product  
ProductVariant  
Category  
Brand  
ProductImage  
MarketProduct  
MarketPrice

Warehouse  
Inventory  
InventoryMovement

Cart  
CartItem

Order  
OrderItem  
Payment  
Shipment

Address

Coupon  
Promotion

Review  
Wishlist  
WishlistItem

Notification  
AuditLog

ShippingZone  
ShippingMethod

ExchangeRate

This is a **conceptual entity list**, not yet the final schema.

The finalized relational model belongs to Phase 2\.

---

# **46\. Data Integrity**

Database constraints should enforce important business rules.

Examples:

* Unique SKU  
* Unique user email  
* Unique permission identifiers  
* Valid foreign keys  
* Appropriate unique combinations  
* Non-negative inventory where applicable  
* Valid monetary values  
* Valid status transitions where enforceable

---

# **47\. Monetary Data**

Money should not be represented using floating-point values.

Use an appropriate PostgreSQL monetary representation, typically:

* Decimal/numeric values  
* Explicit currency code

Example:

amount \= 4999.00  
currency \= PKR

rather than:

4999

without currency context.

---

# **48\. Market Expansion**

The architecture should make this possible:

Markets  
 ├── Pakistan  
 ├── UAE  
 ├── Saudi Arabia  
 ├── Qatar  
 └── Future Markets

Adding a market should primarily involve configuration and required integrations rather than restructuring core business logic.

---

# **49\. Analytics**

Admin analytics should include:

### **Sales**

* Total revenue  
* Revenue by date  
* Revenue by market  
* Revenue by category  
* Revenue by product

### **Orders**

* Total orders  
* Order trends  
* Average order value  
* Order status distribution

### **Customers**

* New customers  
* Returning customers  
* Customer growth

### **Products**

* Best sellers  
* Top-rated products  
* Low-stock products

### **Promotions**

* Coupon usage  
* Discount impact  
* Campaign performance

---

# **50\. Pakistan vs UAE Analytics**

Admin should be able to compare markets.

Example:

| Metric | Pakistan | UAE |
| ----- | ----- | ----- |
| Revenue | — | — |
| Orders | — | — |
| AOV | — | — |
| Customers | — | — |

Exchange rates can be used for consolidated reporting where necessary.

However, storefront prices remain independent.

---

# **51\. Reporting**

Reports should support date filtering.

Common filters:

* Today  
* Yesterday  
* Last 7 days  
* Last 30 days  
* This month  
* Previous month  
* Custom range

Future:

* Export CSV  
* Export Excel  
* Scheduled reports

---

# **52\. Third-Party Integrations**

Architecture should remain provider-independent.

Potential integrations:

### **Payments**

* Pakistan payment providers  
* UAE payment providers

### **Shipping**

* Courier APIs  
* Shipment tracking providers

### **Communication**

* Email provider  
* Future SMS  
* Future WhatsApp

### **Analytics**

* Web analytics  
* Conversion analytics

Specific providers should be selected during architecture/integration planning rather than hard-coded now.

---

# **53\. Admin Settings**

Settings should include appropriate configuration areas:

### **Business**

* Business information  
* Contact information

### **Markets**

* Enabled markets  
* Currency  
* Market availability

### **Commerce**

* Tax  
* Shipping  
* Payment

### **Notifications**

* Email  
* Customer notifications  
* Admin alerts

### **Security**

* Authentication policies  
* Roles  
* Permissions

### **SEO**

* Site metadata  
* Sitemap settings  
* Social metadata

---

# **54\. Error Handling**

The system should provide:

* User-friendly storefront errors  
* Structured API errors  
* Validation errors  
* Authentication errors  
* Authorization errors  
* Payment errors  
* Inventory errors  
* Checkout errors

Internal technical information must not be unnecessarily exposed to customers.

---

# **55\. Observability**

Production deployment should support:

* Application logging  
* Error tracking  
* Database monitoring  
* Performance monitoring  
* API monitoring

Critical failures should be identifiable quickly.

---

# **56\. Testing Strategy**

Testing should exist at multiple levels.

### **Unit Tests**

Test:

* Pricing  
* Discounts  
* Tax calculations  
* Shipping calculations  
* Permission logic  
* Inventory logic

### **Integration Tests**

Test:

* Authentication  
* Product APIs  
* Cart  
* Checkout  
* Orders  
* Payments  
* Inventory

### **End-to-End Tests**

Important customer journeys:

Browse → Cart → Checkout → Order

and:

Admin → Product → Inventory → Order  
---

# **57\. Responsive Design**

The storefront must work across:

* Desktop  
* Laptop  
* Tablet  
* Mobile

The mobile experience is especially important because e-commerce traffic can be heavily mobile-oriented.

Admin should also be responsive, although desktop remains the primary administrative environment.

---

# **58\. UX Principles**

The storefront should prioritize:

1. Minimal friction  
2. Clear pricing  
3. Fast navigation  
4. Strong product presentation  
5. Trust  
6. Simple checkout  
7. Clear availability  
8. Strong mobile UX

The admin dashboard should prioritize:

1. Operational efficiency  
2. Information hierarchy  
3. Fast actions  
4. Clear status  
5. Search/filter capabilities  
6. Safe destructive actions

---

# **59\. MVP Scope**

The MVP should focus on the functionality necessary to operate the business commercially.

## **MVP — Storefront**

* Market selection  
* Homepage  
* Categories  
* Product listing  
* Product details  
* Search  
* Basic filtering  
* Product variants  
* Market-specific pricing  
* Cart  
* Checkout  
* Customer authentication  
* Addresses  
* Orders  
* Order history  
* Order tracking/status  
* Wishlist  
* Basic reviews  
* Discount codes  
* Responsive design  
* SEO fundamentals

## **MVP — Admin**

* Dashboard  
* Products  
* Categories  
* Variants  
* Pricing  
* Market configuration  
* Inventory  
* Orders  
* Customers  
* Coupons  
* Basic promotions  
* Shipping configuration  
* Payment configuration  
* Users  
* Roles  
* Permissions  
* Audit logs  
* Basic analytics  
* Content management

---

# **60\. Phase 2 Features**

After MVP stabilization:

* Advanced promotions  
* Buy X Get Y  
* Advanced customer segmentation  
* Advanced analytics  
* Advanced recommendations  
* Recently viewed server persistence  
* Enhanced search  
* Product comparison  
* Advanced shipping rules  
* Returns management improvements  
* Advanced notifications  
* Email marketing integration  
* Advanced reporting  
* More sophisticated CMS

---

# **61\. Phase 3 Features**

Longer-term expansion:

* Additional international markets  
* Advanced personalization  
* AI product recommendations  
* Semantic search  
* Advanced customer intelligence  
* Loyalty program  
* Referral program  
* Subscription products  
* Advanced marketing automation  
* SMS/WhatsApp integration  
* Multi-warehouse optimization  
* Advanced forecasting  
* Advanced business intelligence

---

# **62\. Features Deliberately Not Required Initially**

To avoid unnecessary complexity, the initial product should **not automatically include** every feature found in large platforms.

Examples that can remain future scope:

* Full marketplace functionality  
* Multiple independent sellers  
* Complex seller management  
* Advanced ERP  
* Advanced accounting  
* AI personalization  
* Subscription engine  
* Highly complex loyalty system  
* Full marketing automation platform

These should only be introduced when justified by business requirements.

---

# **63\. Scalability Strategy**

The system should initially favor a **modular monolithic architecture** rather than premature microservices.

Conceptually:

Next.js Application  
       │  
       ├── Auth  
       ├── Catalog  
       ├── Pricing  
       ├── Cart  
       ├── Checkout  
       ├── Orders  
       ├── Payments  
       ├── Shipping  
       ├── Inventory  
       ├── Customers  
       ├── Promotions  
       ├── Reviews  
       ├── Notifications  
       └── Analytics  
              │  
              ↓  
          PostgreSQL

The modules should have clear boundaries so individual components can later be extracted if scale requires it.

---

# **64\. Caching Strategy**

Caching may be used for:

* Product catalog  
* Categories  
* Static content  
* Market configuration  
* Non-user-specific content

Dynamic customer-specific data should not be incorrectly cached.

---

# **65\. Deployment Requirements**

Production deployment should support:

Internet  
   ↓  
CDN / Edge  
   ↓  
Next.js Application  
   ↓  
PostgreSQL

Additional infrastructure can later include:

Redis  
Background Workers  
Object Storage  
Monitoring  
Search Engine

These should only be introduced when justified.

---

# **66\. File & Image Storage**

Product images should not unnecessarily live inside PostgreSQL.

A production architecture should use suitable object storage/CDN infrastructure.

The application should store:

* Image URL/reference  
* Metadata  
* Ordering  
* Alt text

---

# **67\. Background Processing**

Some operations may eventually be processed asynchronously:

* Emails  
* Notifications  
* Image processing  
* Analytics aggregation  
* Promotional campaign execution  
* Reports

This can evolve into a queue/worker architecture when required.

---

# **68\. Business Rules**

Important business rules include:

### **Price**

Market price overrides exchange-rate conversion.

### **Inventory**

A product cannot normally be purchased beyond available inventory.

### **Checkout**

Server validates all commercial values before creating the order.

### **Discounts**

Discount eligibility must be calculated server-side.

### **Payment**

Order/payment status must be reconciled safely with provider responses.

### **Orders**

Historical order pricing must remain immutable.

### **Authorization**

Every administrative operation must verify permissions.

---

# **69\. Acceptance Criteria — Core Platform**

The MVP is considered functionally ready when:

* Customers can select Pakistan or UAE.  
* Prices change according to selected market.  
* Pakistan and UAE prices are independently configurable.  
* Market-specific products can be enabled/disabled.  
* Customers can browse products.  
* Customers can search/filter products.  
* Customers can add products to cart.  
* Customers can complete checkout.  
* Orders can be created.  
* Admin can manage products.  
* Admin can manage inventory.  
* Admin can manage orders.  
* Admin can configure shipping.  
* Admin can configure payment methods.  
* Admin can manage coupons.  
* RBAC controls administrative actions.  
* Audit logs capture important changes.  
* Core SEO functionality works.  
* Application is responsive.  
* Critical flows are tested.

---

# **70\. Technical Acceptance Criteria**

Before production:

### **Security**

* Authentication secured  
* Authorization verified  
* Sensitive secrets server-side  
* Input validation implemented  
* Rate limiting implemented where required  
* Secure cookies/session strategy  
* File upload restrictions

### **Database**

* Foreign keys  
* Constraints  
* Indexes  
* Transactions where required  
* Proper monetary types

### **Performance**

* Efficient queries  
* Pagination  
* Appropriate caching  
* Optimized images  
* Minimal unnecessary client rendering

### **Testing**

* Unit tests  
* Integration tests  
* Critical E2E tests

---

# **71\. Development Phases**

The complete project should follow this sequence:

PHASE 1  
PRD  
   ↓  
Approval

PHASE 2  
System Architecture  
Database  
API  
Security  
RBAC  
   ↓  
Approval

PHASE 3  
UX/UI  
Design System  
Storefront  
Admin  
   ↓  
Approval

PHASE 4  
Development  
   ↓  
Module-by-module implementation

PHASE 5  
Testing  
Security  
Performance  
   ↓  
Production Readiness

PHASE 6  
Deployment  
Monitoring  
Maintenance  
---

# **72\. Claude Code Development Strategy**

Claude Code should work within controlled scopes.

Each implementation task should specify:

Context  
↓  
Objective  
↓  
Scope  
↓  
Files allowed to change  
↓  
Architecture rules  
↓  
Implementation requirements  
↓  
Validation  
↓  
Testing  
↓  
Acceptance criteria

Claude Code should **not** be instructed to arbitrarily redesign existing modules.

Existing functionality must be preserved unless explicitly included in the task scope.

---

# **73\. Recommended Module Boundaries**

The eventual application should have clear domain boundaries around:

Authentication  
Users  
RBAC  
Markets  
Catalog  
Pricing  
Inventory  
Cart  
Checkout  
Orders  
Payments  
Shipping  
Promotions  
Customers  
Reviews  
Wishlist  
Notifications  
CMS  
Analytics  
Audit  
Settings

These boundaries will become much more precise during **Phase 2 — System Architecture**.

---

# **74\. Major Risks**

## **Risk 1 — Market Complexity**

Pakistan and UAE have different:

* Currencies  
* Payment methods  
* Shipping  
* Pricing  
* Tax considerations

**Mitigation:** configuration-driven market architecture.

---

## **Risk 2 — Incorrect Pricing**

Using currency conversion for storefront pricing could create incorrect commercial prices.

**Mitigation:** independent market prices.

---

## **Risk 3 — Overengineering**

Adding microservices and unnecessary infrastructure too early increases complexity.

**Mitigation:** modular monolith initially.

---

## **Risk 4 — Payment Reliability**

Payment provider failures can produce inconsistent order states.

**Mitigation:** payment abstraction \+ transaction/idempotency strategy during architecture.

---

## **Risk 5 — Inventory Race Conditions**

Multiple customers may attempt to purchase the same limited stock.

**Mitigation:** transactional inventory reservation/decrement strategy.

---

## **Risk 6 — AI-Assisted Development Drift**

AI coding tools can modify unrelated areas.

**Mitigation:** tightly scoped Claude Code prompts \+ architecture rules \+ tests.

---

# **75\. Future Architecture Direction**

The platform should be capable of evolving toward:

                   ┌───────────────┐  
                    │   Storefront  │  
                    └───────┬───────┘  
                            │  
                    ┌───────▼───────┐  
                    │ Commerce Core  │  
                    └───────┬───────┘  
                            │  
       ┌────────────┬───────┼────────┬─────────────┐  
       ↓            ↓       ↓        ↓             ↓  
    Catalog      Orders  Payments Shipping      Inventory  
       │            │       │        │             │  
       └────────────┴───────┼────────┴─────────────┘  
                            ↓  
                       PostgreSQL

Later, if justified:

Search  
Redis  
Workers  
Analytics  
Recommendation Engine  
External Integrations

can be independently scaled.

---

# **76\. Final MVP Definition**

The first production release should answer one fundamental question:

> **Can the business reliably sell its products online in Pakistan and UAE from a single administration system?**

The MVP must therefore prioritize:

**Catalog → Market Pricing → Inventory → Cart → Checkout → Payment → Orders → Shipping → Customers → Administration**

Everything else should support those core operations rather than distract from them.

---

# **77\. PRD Completion Status**

### **Phase 1 — PRD**

**Status: COMPLETE**

Covered:

* Product vision  
* Business objectives  
* Markets  
* Personas  
* User journeys  
* Storefront  
* Product catalog  
* Variants  
* Pricing  
* Inventory  
* Cart  
* Checkout  
* Orders  
* Payments  
* Shipping  
* Promotions  
* Reviews  
* Notifications  
* Admin  
* RBAC  
* Audit logs  
* Analytics  
* SEO  
* Security  
* Performance  
* Accessibility  
* Database requirements  
* API requirements  
* Integrations  
* Testing  
* Deployment  
* Scalability  
* Claude Code workflow  
* MVP  
* Phase 2  
* Phase 3  
* Risks  
* Acceptance criteria

# **Phase 2 — System Architecture**

This phase converts the approved PRD into a **production-grade technical blueprint**. The architecture below is intentionally implementation-oriented, but **no application code is being written yet**.

---

# **1\. Architecture Decision Summary**

| Area | Recommended Architecture |
| ----- | ----- |
| Application | Modular Monolith |
| Frontend | Next.js \+ React \+ TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js server-side architecture |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Secure server-managed session architecture |
| Authorization | RBAC \+ granular permissions |
| API | Domain-oriented API layer |
| Validation | Schema-based validation |
| Payments | Provider abstraction |
| Shipping | Provider/configuration abstraction |
| Storage | Object storage for media |
| Cache | Add Redis when justified |
| Background Jobs | Queue/worker architecture when required |
| Realtime | Optional WebSocket/SSE layer where required |
| Search | PostgreSQL initially; dedicated search engine later if justified |
| Deployment | Container/cloud-ready |
| Architecture Style | Domain-modular, transaction-safe, API-first |

### **Key decision**

**Do not start with microservices.**

A modular monolith gives us:

* simpler deployment  
* easier development  
* simpler transactions  
* lower infrastructure cost  
* easier debugging  
* strong module boundaries  
* ability to extract services later

---

# **2\. High-Level Architecture**

                        INTERNET  
                            │  
                            ▼  
                    ┌───────────────┐  
                    │ CDN / Edge    │  
                    └───────┬───────┘  
                            │  
                            ▼  
                 ┌─────────────────────┐  
                 │     Next.js App      │  
                 │                     │  
                 │ Storefront           │  
                 │ Admin Dashboard      │  
                 │ Server Components    │  
                 │ API / Server Actions │  
                 └──────────┬──────────┘  
                            │  
              ┌─────────────┼──────────────┐  
              │             │              │  
              ▼             ▼              ▼  
        Domain Modules   Auth/RBAC    Integrations  
              │             │              │  
              └─────────────┼──────────────┘  
                            │  
                            ▼  
                    ┌──────────────┐  
                    │   Prisma     │  
                    └──────┬───────┘  
                           │  
                           ▼  
                    ┌──────────────┐  
                    │ PostgreSQL   │  
                    └──────────────┘

Supporting infrastructure:

Object Storage ─── Product Images  
Email Provider ─── Notifications  
Payment Providers ─ Payments  
Shipping Providers ─ Shipments  
Redis ─────────── Cache / Rate Limits / Jobs  
Monitoring ────── Logs / Errors / Metrics  
---

# **3\. Most Important Domain Principle**

The system represents:

> **One business operating across multiple markets.**

It is **not** a marketplace containing independent businesses.

The core model is:

Business  
   │  
   ├── Pakistan Market  
   │  
   └── UAE Market

Future:

Business  
   │  
   ├── Pakistan  
   ├── UAE  
   ├── Saudi Arabia  
   └── Other Markets

This distinction is critical because the system should not introduce unnecessary tenant/business isolation.

---

# **4\. Domain Architecture**

The application should be divided into business domains.

┌─────────────────────────────────────────────┐  
│                 APPLICATION                 │  
├─────────────────────────────────────────────┤  
│                                             │  
│ Identity & Access                            │  
│ Markets                                      │  
│ Catalog                                      │  
│ Pricing                                      │  
│ Inventory                                    │  
│ Cart                                         │  
│ Checkout                                     │  
│ Orders                                       │  
│ Payments                                     │  
│ Shipping                                     │  
│ Customers                                    │  
│ Promotions                                   │  
│ Reviews                                      │  
│ Wishlist                                     │  
│ Notifications                                │  
│ CMS / Content                                │  
│ Analytics                                    │  
│ Audit                                        │  
│ Settings                                     │  
│                                             │  
└─────────────────────────────────────────────┘

Each domain should own its:

* business rules  
* services  
* validation  
* data access  
* authorization requirements  
* domain types

---

# **5\. Domain Dependency Model**

A simplified dependency flow:

Identity  
   │  
   ├───────────────┐  
   ▼               ▼  
Customers        Admin/RBAC  
   │  
   ▼  
Catalog  
   │  
   ▼  
Pricing  
   │  
   ▼  
Cart  
   │  
   ▼  
Checkout  
   │  
   ├──────► Inventory  
   ├──────► Promotions  
   ├──────► Shipping  
   └──────► Payments  
                │  
                ▼  
              Order  
                │  
        ┌───────┴────────┐  
        ▼                ▼  
    Shipment         Notification  
---

# **6\. Core Domain Modules**

## **6.1 Identity & Access**

Responsibilities:

* Authentication  
* Registration  
* Login  
* Logout  
* Password management  
* Email verification  
* Sessions  
* Roles  
* Permissions  
* Authorization

---

## **6.2 Market**

Responsibilities:

* Markets  
* Currency  
* Market availability  
* Market configuration  
* Market-specific product availability

Example:

Market  
 ├── Pakistan  
 │     currency \= PKR  
 │  
 └── UAE  
       currency \= AED  
---

# **7\. Catalog Domain**

Responsible for:

* Products  
* Product variants  
* Categories  
* Subcategories  
* Brands  
* Images  
* Attributes  
* Product content  
* SEO

Relationship:

Category  
   │  
   └── Products  
          │  
          └── Variants  
---

# **8\. Pricing Domain**

Pricing deserves its own domain because it is one of the most important business rules.

Product  
   │  
   ├── Pakistan Price  
   │  
   └── UAE Price

Potential architecture:

Product  
   │  
   ▼  
Market Product  
   │  
   ▼  
Market Price

This allows:

* base price  
* sale price  
* scheduled price  
* market-specific pricing

without coupling pricing to the product itself.

---

# **9\. Inventory Domain**

Inventory should be independent from product catalog.

Product Variant  
       │  
       ▼  
Inventory Item  
       │  
       ▼  
Inventory Movements

Inventory movements provide an audit trail.

Example:

Purchase       \+100  
Sale             \-2  
Damage           \-1  
Return           \+1  
Adjustment       \-3  
---

# **10\. Cart Domain**

Cart belongs to a customer/session.

Cart  
 │  
 └── Cart Items  
       │  
       ├── Product Variant  
       ├── Quantity  
       └── Current Pricing Context

Important:

Cart values must **not be trusted blindly** during checkout.

The server must recalculate:

* product price  
* promotion  
* shipping  
* tax  
* total  
* inventory

---

# **11\. Checkout Domain**

Checkout orchestrates multiple domains.

Checkout  
   │  
   ├── Customer  
   ├── Address  
   ├── Market  
   ├── Pricing  
   ├── Promotions  
   ├── Inventory  
   ├── Shipping  
   └── Payment

Checkout should eventually produce:

Order  
---

# **12\. Order Domain**

The order becomes the **commercial record** of the transaction.

An order should preserve snapshots.

Order  
 ├── Market  
 ├── Currency  
 ├── Customer  
 ├── Billing Address  
 ├── Shipping Address  
 ├── Items  
 │    ├── Product Snapshot  
 │    ├── SKU Snapshot  
 │    ├── Price Snapshot  
 │    └── Quantity  
 ├── Discount  
 ├── Shipping  
 ├── Tax  
 └── Total

This protects historical orders from future catalog changes.

---

# **13\. Payment Architecture**

Do not couple orders directly to a specific payment provider.

Use:

                   Payment Service  
                          │  
             ┌────────────┼────────────┐  
             ▼            ▼            ▼  
          Provider A   Provider B    COD

A provider adapter should translate provider-specific behavior into a common internal payment model.

---

# **14\. Payment Flow**

Customer  
   │  
   ▼  
Checkout  
   │  
   ▼  
Create Payment Intent  
   │  
   ▼  
Payment Provider  
   │  
   ├── Success  
   ├── Failure  
   └── Pending  
   │  
   ▼  
Payment Webhook  
   │  
   ▼  
Verify Event  
   │  
   ▼  
Update Payment  
   │  
   ▼  
Update Order

### **Important**

The frontend redirect alone should **never** be treated as proof of successful payment.

Provider webhook/server verification should be authoritative.

---

# **15\. Shipping Architecture**

Shipping follows a similar abstraction.

Shipping Service  
      │  
      ├── Pakistan Rules  
      ├── UAE Rules  
      └── External Carrier

The system should support configurable internal shipping methods even when no external courier API exists.

---

# **16\. Inventory \+ Order Transaction**

One of the most important transactional flows:

Checkout  
   │  
   ▼  
Validate Inventory  
   │  
   ▼  
Calculate Price  
   │  
   ▼  
Apply Promotion  
   │  
   ▼  
Create Order  
   │  
   ▼  
Reserve/Decrement Inventory  
   │  
   ▼  
Create Payment

Critical operations should use PostgreSQL transactions where atomicity is required.

---

# **17\. Preventing Overselling**

Potential problem:

Stock \= 1

Customer A → buys 1  
Customer B → buys 1

Both requests may arrive simultaneously.

The inventory system must use appropriate transactional/concurrency controls.

Architecture should support:

* atomic stock updates  
* transaction boundaries  
* inventory reservations where appropriate  
* idempotency

This will be finalized in the implementation architecture.

---

# **18\. RBAC Architecture**

Authorization model:

User  
 │  
 ▼  
Role  
 │  
 ▼  
Permissions

Potential many-to-many relationships:

User ─── UserRole ─── Role  
                         │  
                         ▼  
                   RolePermission  
                         │  
                         ▼  
                    Permission

Permission examples:

products:create  
products:read  
products:update  
products:archive

orders:read  
orders:update  
orders:cancel

inventory:read  
inventory:update

promotions:create  
promotions:update  
---

# **19\. Authorization Layers**

Authorization should exist at multiple levels.

### **Route/API**

Can the user access the operation?

### **Permission**

Does the user have:

orders:update

?

### **Resource**

Can the user modify this particular resource?

This prevents authorization from becoming merely:

isAdmin \=== true  
---

# **20\. Database Architecture**

Conceptual database:

                   ┌─────────────┐  
                    │    User     │  
                    └──────┬──────┘  
                           │  
                    ┌──────▼──────┐  
                    │    Role     │  
                    └──────┬──────┘  
                           │  
                    ┌──────▼──────┐  
                    │ Permission  │  
                    └─────────────┘

Market ─────────────┐  
                    │  
                    ▼  
Product ───────► Variant  
   │                  │  
   │                  ▼  
   │              Inventory  
   │  
   ▼  
Category

Market \+ Product  
       │  
       ▼  
Market Pricing

Commerce:

Customer  
   │  
   ├── Address  
   │  
   ├── Cart  
   │  
   ├── Wishlist  
   │  
   └── Orders  
            │  
            ├── Order Items  
            ├── Payment  
            └── Shipment

Marketing:

Product ───────┐  
Category ──────┼──► Promotion  
Market ────────┘

Coupon ───────► Promotion  
---

# **21\. Core Entity Model**

The conceptual entities should include:

### **Identity**

* User  
* Role  
* Permission  
* UserRole  
* RolePermission  
* Session  
* VerificationToken / equivalent authentication artifacts

### **Market**

* Market  
* MarketSettings  
* ExchangeRate

### **Catalog**

* Product  
* ProductVariant  
* Category  
* Brand  
* ProductImage  
* ProductAttribute

### **Pricing**

* MarketProduct  
* MarketPrice

### **Inventory**

* Warehouse  
* Inventory  
* InventoryMovement

### **Commerce**

* Cart  
* CartItem  
* Order  
* OrderItem

### **Customer**

* CustomerProfile  
* Address  
* Wishlist  
* WishlistItem

### **Payment**

* Payment  
* PaymentTransaction / provider reference

### **Shipping**

* ShippingZone  
* ShippingMethod  
* Shipment

### **Marketing**

* Promotion  
* Coupon  
* CouponUsage

### **Engagement**

* Review  
* Notification

### **Administration**

* AuditLog

### **Content**

* Banner  
* ContentSection  
* FAQ

---

# **22\. Important Database Relationship**

The pricing model should conceptually be:

Product  
   │  
   └── ProductVariant  
           │  
           └── MarketPrice  
                   │  
                   └── Market

This provides:

Variant A  
 ├── Pakistan → PKR 4,999  
 └── UAE → AED 149

rather than attempting:

PKR 4,999 × exchange rate \= AED price  
---

# **23\. Product vs Variant**

A product represents the commercial concept.

Example:

**Shilajit Resin**

Variants:

20g  
30g  
50g

Inventory should generally operate at the **variant/SKU level**.

Therefore:

Product  
   ↓  
Variant  
   ↓  
SKU  
   ↓  
Inventory  
---

# **24\. Order Item Snapshot**

Do not rely entirely on foreign-key references to reconstruct historical orders.

An order item should preserve relevant information such as:

Product name at purchase  
Variant name at purchase  
SKU at purchase  
Unit price  
Quantity  
Discount  
Tax

This prevents historical orders from changing when the product is later edited.

---

# **25\. Market Context**

Market should be resolved early in the request/customer journey.

Request  
  │  
  ▼  
Market Context  
  │  
  ├── Currency  
  ├── Product Availability  
  ├── Price  
  ├── Shipping  
  ├── Payment  
  └── Promotions

The market should be explicitly represented in relevant commerce operations.

---

# **26\. Currency Architecture**

Currency is not merely a UI formatting preference.

It affects:

* Product pricing  
* Cart  
* Orders  
* Payments  
* Shipping  
* Promotions  
* Reports

Every financial transaction should carry appropriate currency context.

---

# **27\. Exchange Rate Architecture**

Separate:

Storefront Pricing

from:

Exchange Rate

Exchange rates exist primarily for:

* reporting  
* analytics  
* financial comparison

Example:

Pakistan Revenue  
PKR 5,000,000

       ↓ Exchange Rate

Reporting Currency  
AED equivalent

The conversion should never silently modify configured market prices.

---

# **28\. Admin Architecture**

Admin application:

Admin  
 │  
 ├── Dashboard  
 ├── Catalog  
 ├── Pricing  
 ├── Inventory  
 ├── Orders  
 ├── Customers  
 ├── Promotions  
 ├── Shipping  
 ├── Payments  
 ├── Content  
 ├── Analytics  
 ├── Users  
 ├── Roles  
 ├── Permissions  
 ├── Audit Logs  
 └── Settings  
---

# **29\. Storefront Architecture**

Storefront  
 │  
 ├── Home  
 ├── Shop  
 │    ├── Categories  
 │    └── Search  
 │  
 ├── Product  
 │  
 ├── Cart  
 │  
 ├── Checkout  
 │  
 ├── Account  
 │    ├── Orders  
 │    ├── Addresses  
 │    ├── Wishlist  
 │    └── Profile  
 │  
 └── Informational Pages  
---

# **30\. Recommended Next.js Structure**

Conceptually:

src/  
│  
├── app/  
│   ├── (storefront)/  
│   ├── (account)/  
│   ├── (checkout)/  
│   ├── admin/  
│   └── api/  
│  
├── modules/  
│   ├── auth/  
│   ├── users/  
│   ├── rbac/  
│   ├── markets/  
│   ├── catalog/  
│   ├── pricing/  
│   ├── inventory/  
│   ├── cart/  
│   ├── checkout/  
│   ├── orders/  
│   ├── payments/  
│   ├── shipping/  
│   ├── customers/  
│   ├── promotions/  
│   ├── reviews/  
│   ├── wishlist/  
│   ├── notifications/  
│   ├── cms/  
│   ├── analytics/  
│   └── audit/  
│  
├── components/  
│  
├── lib/  
│  
├── config/  
│  
├── hooks/  
│  
├── types/  
│  
└── prisma/

This is a **conceptual structure**. The exact folder structure should be finalized before development.

---

# **31\. Why Domain Modules Matter**

Without modules, we could end up with:

components/  
services/  
utils/  
controllers/

containing hundreds of unrelated files.

Instead:

modules/orders/  
modules/products/  
modules/inventory/

keeps related business logic together.

This is particularly important when using AI coding tools.

---

# **32\. Server vs Client Architecture**

Default:

**Server-first.**

Use Server Components for:

* Product pages  
* Category pages  
* SEO content  
* Product data  
* Admin data views where interactive behavior isn't required

Use Client Components when required for:

* Cart interactions  
* Filters  
* Product selectors  
* Checkout interactions  
* Modals  
* Interactive dashboards  
* Forms requiring client-side behavior

Avoid turning entire pages into client components unnecessarily.

---

# **33\. Data Access Architecture**

Application flow should generally be:

UI  
 ↓  
Application/Action Layer  
 ↓  
Domain Service  
 ↓  
Repository/Data Access  
 ↓  
Prisma  
 ↓  
PostgreSQL

Business logic should not be scattered across UI components.

---

# **34\. Validation Architecture**

Validate input at the boundary.

Request  
 ↓  
Schema Validation  
 ↓  
Authentication  
 ↓  
Authorization  
 ↓  
Business Logic  
 ↓  
Database

Validation should exist for:

* forms  
* API input  
* query parameters  
* administrative actions  
* payment callbacks  
* webhooks

---

# **35\. API Architecture**

Use domain-oriented endpoints.

Conceptually:

/api/v1/products  
/api/v1/categories  
/api/v1/cart  
/api/v1/checkout  
/api/v1/orders  
/api/v1/payments  
/api/v1/shipping  
/api/v1/customers  
/api/v1/reviews  
/api/v1/promotions  
/api/v1/inventory

Internal server operations can use appropriate server actions/services where that produces a cleaner architecture.

---

# **36\. API Response Architecture**

Responses should be consistent.

Conceptually:

Success  
{  
  data,  
  metadata  
}

Errors should provide:

code  
message  
fieldErrors

without exposing internal stack traces or sensitive implementation information.

---

# **37\. Idempotency**

Critical operations should support idempotency.

Especially:

* Checkout  
* Payment creation  
* Payment webhook processing  
* Order creation  
* Refunds

Example:

Request A  
   ↓  
Create Order

Request A repeated  
   ↓  
Return existing operation

rather than creating duplicate orders.

---

# **38\. Payment Webhook Security**

Payment webhooks must:

1. Verify provider authenticity/signature.  
2. Validate payload.  
3. Identify the relevant transaction.  
4. Check event state.  
5. Process idempotently.  
6. Update payment/order safely.

---

# **39\. Audit Architecture**

Administrative mutations should generate audit events.

Admin  
 ↓  
Action  
 ↓  
Domain Service  
 ├── Database Change  
 └── Audit Event

This creates operational accountability.

---

# **40\. Notification Architecture**

Use an abstraction:

Notification Service  
       │  
       ├── Email  
       ├── In-App  
       ├── SMS (future)  
       └── WhatsApp (future)

Business logic should not directly depend on one email provider.

---

# **41\. Image Architecture**

Recommended flow:

Admin  
 ↓  
Upload  
 ↓  
Validation  
 ↓  
Object Storage  
 ↓  
CDN  
 ↓  
Store Image Reference

PostgreSQL stores metadata/references rather than large binary files.

---

# **42\. Search Architecture**

### **Initial phase**

PostgreSQL can handle:

* basic product search  
* filtering  
* sorting  
* indexing

### **Future scale**

A dedicated search engine can be introduced if:

* catalog becomes large  
* search relevance requirements increase  
* typo tolerance becomes important  
* faceted search becomes complex

Possible future architecture:

PostgreSQL  
     │  
     ▼  
Search Index  
     │  
     ▼  
Storefront Search

Do not introduce a search engine prematurely.

---

# **43\. Redis**

Redis is **not mandatory for MVP**.

Potential future uses:

* caching  
* rate limiting  
* sessions where appropriate  
* distributed locks  
* queues  
* temporary checkout state

Introduce it when there is an actual requirement.

---

# **44\. Background Jobs**

Long-running/non-critical operations should eventually be separated from request-response cycles.

Example:

Order Created  
      │  
      ├── Save Order  
      │  
      └── Queue  
            │  
            ├── Send Email  
            ├── Send Notification  
            └── Analytics Event  
---

# **45\. Caching Strategy**

Potential cache layers:

Browser  
   ↓  
CDN  
   ↓  
Next.js Cache  
   ↓  
Application Cache  
   ↓  
PostgreSQL

But cache invalidation must be carefully designed for:

* pricing  
* inventory  
* promotions

These cannot use careless long-lived caching.

---

# **46\. Security Architecture**

Security layers:

Internet  
   ↓  
HTTPS  
   ↓  
Rate Limiting  
   ↓  
Authentication  
   ↓  
Authorization  
   ↓  
Input Validation  
   ↓  
Business Rules  
   ↓  
Database

Additional protections:

* secure headers  
* secure cookies  
* CSRF strategy  
* XSS prevention  
* secret isolation  
* upload validation  
* audit logging

---

# **47\. Authentication Flow**

Conceptually:

Register  
 ↓  
Validate  
 ↓  
Hash Password  
 ↓  
Create User  
 ↓  
Email Verification  
 ↓  
Verified  
 ↓  
Login  
 ↓  
Create Secure Session

Password reset:

Forgot Password  
 ↓  
Generate Short-Lived Token  
 ↓  
Email  
 ↓  
Verify Token  
 ↓  
Set New Password  
---

# **48\. Session Architecture**

For a web-first Next.js application, use secure server-managed authentication/session handling.

Important principles:

* HTTP-only cookies where applicable  
* Secure flag in production  
* Appropriate SameSite policy  
* Session expiration  
* Session invalidation  
* Password-change session invalidation where appropriate

Exact implementation will be finalized in the technical design.

---

# **49\. Data Access Security**

Never trust:

userId  
marketId  
price  
role  
permissions  
orderTotal

coming from the client.

The server must derive or verify sensitive values.

---

# **50\. Admin Security**

Administrative operations should receive stronger controls.

Potential future additions:

* MFA  
* login anomaly detection  
* admin session timeout  
* sensitive-action confirmation  
* IP/device monitoring

MFA is strongly recommended before production for privileged accounts.

---

# **51\. Database Indexing Strategy**

Indexes should target actual query patterns.

Likely candidates:

* User email  
* Product slug  
* Product SKU  
* Product status  
* Category slug  
* Market code  
* Order number  
* Order customer  
* Order status  
* Order date  
* Inventory SKU  
* Promotion code

Composite indexes will be considered based on actual queries.

---

# **52\. Database Transactions**

Use transactions for operations where multiple changes must succeed or fail together.

Examples:

### **Order creation**

Create Order  
\+  
Create Order Items  
\+  
Update Inventory  
\+  
Create Payment Record

### **Refund**

Refund Record  
\+  
Order Update  
\+  
Inventory Return

Exact boundaries will be designed during Prisma schema/service implementation.

---

# **53\. Soft Delete Strategy**

For business-critical entities, prefer archival/status mechanisms over immediate deletion.

Examples:

Product  
 → ACTIVE  
 → ARCHIVED

rather than physically deleting historical product data.

Orders should generally never be casually deleted.

---

# **54\. Order State Architecture**

Separate concepts where necessary.

For example:

Order Status  
Payment Status  
Shipment Status

rather than forcing everything into one status field.

Example:

Order  
 ├── status \= PROCESSING  
 ├── paymentStatus \= PAID  
 └── shipmentStatus \= PREPARING

This provides much better operational flexibility.

---

# **55\. Recommended Order Lifecycle**

PENDING  
   ↓  
CONFIRMED  
   ↓  
PROCESSING  
   ↓  
SHIPPED  
   ↓  
DELIVERED

Possible alternative transitions:

PENDING → CANCELLED  
CONFIRMED → CANCELLED  
PROCESSING → CANCELLED  
DELIVERED → RETURN REQUESTED

Exact state machine rules should be finalized during implementation architecture.

---

# **56\. Return & Refund Architecture**

Returns should be modeled separately from basic cancellation.

Future model:

Order  
 ↓  
Return Request  
 ↓  
Review  
 ↓  
Approved / Rejected  
 ↓  
Return Received  
 ↓  
Refund

This is preferable to trying to represent every return scenario through the Order status.

---

# **57\. Analytics Architecture**

Initial analytics can query PostgreSQL.

For larger scale:

Transactional DB  
       │  
       ▼  
Events / Aggregation  
       │  
       ▼  
Analytics Store

Do not build a separate data warehouse for MVP unless business scale requires it.

---

# **58\. Observability**

Production system should eventually include:

Application  
 ├── Logs  
 ├── Errors  
 ├── Performance  
 └── Business Metrics

Important metrics:

* request latency  
* error rate  
* failed payments  
* checkout failures  
* database latency  
* inventory conflicts

---

# **59\. Deployment Architecture**

Initial production:

                CDN / Edge  
                     │  
                     ▼  
              Next.js Application  
                     │  
              ┌──────┴───────┐  
              ▼              ▼  
          PostgreSQL      Object Storage

External:

Payment Providers  
Shipping Providers  
Email Provider  
Monitoring  
---

# **60\. Future Scaled Deployment**

When required:

                      CDN  
                        │  
                 Load Balancer  
                        │  
             ┌──────────┴──────────┐  
             ▼                     ▼  
        App Instance 1        App Instance 2  
             │                     │  
             └──────────┬──────────┘  
                        ▼  
                      Redis  
                        │  
                        ▼  
                   PostgreSQL  
                        │  
                  Read Replicas

Background workers:

Queue  
 │  
 ├── Worker 1  
 ├── Worker 2  
 └── Worker 3  
---

# **61\. Disaster Recovery**

Production architecture should eventually include:

* automated database backups  
* backup retention  
* recovery testing  
* object-storage redundancy  
* environment separation

Environments:

Development  
     ↓  
Staging  
     ↓  
Production

Production should never be the testing environment.

---

# **62\. Environment Configuration**

Separate:

Development  
Staging  
Production

Sensitive configuration belongs in environment/secrets management.

Examples:

DATABASE\_URL  
AUTH\_SECRET  
PAYMENT\_SECRET  
EMAIL\_API\_KEY  
STORAGE\_SECRET

Never commit secrets to Git.

---

# **63\. Environment Rules**

Development:

* local services  
* test payments  
* development database

Staging:

* production-like architecture  
* sandbox providers  
* realistic testing

Production:

* real payments  
* production database  
* production credentials  
* monitoring  
* backups

---

# **64\. Architecture Quality Attributes**

The system should optimize for:

### **Maintainability**

Clear domain boundaries.

### **Scalability**

Stateless application \+ scalable database strategy.

### **Reliability**

Transactions \+ idempotency \+ monitoring.

### **Security**

Authentication \+ authorization \+ validation.

### **Performance**

Server-first rendering \+ optimized queries \+ caching.

### **Extensibility**

Provider abstractions \+ market configuration.

---

# **65\. Architecture Anti-Patterns to Avoid**

### **❌ Hard-coded country logic**

if country \=== "PK"

everywhere.

Instead use market configuration.

### **❌ Hard-coded role checks**

if admin

Instead use permissions.

### **❌ Provider-specific business logic**

Don't spread Stripe/provider-specific logic across orders.

### **❌ Client-controlled totals**

Never trust cart totals from browser.

### **❌ Product price inside Order**

Don't dynamically read current product price for historical orders.

### **❌ Giant service files**

Keep domain services focused.

### **❌ Premature microservices**

Don't distribute the application before there is a scaling reason.

---

# **66\. Final Architecture Blueprint**

Putting everything together:

                        CUSTOMER  
                            │  
                            ▼  
                    ┌───────────────┐  
                    │   Next.js     │  
                    │  Storefront   │  
                    └───────┬───────┘  
                            │  
                            ▼  
                  ┌───────────────────┐  
                  │ Application Layer │  
                  └─────────┬─────────┘  
                            │  
       ┌────────────────────┼────────────────────┐  
       │                    │                    │  
       ▼                    ▼                    ▼  
    Identity             Commerce            Admin  
       │                    │                    │  
       │          ┌─────────┼──────────┐         │  
       │          │         │          │         │  
       ▼          ▼         ▼          ▼         ▼  
     RBAC      Catalog   Pricing   Inventory   Analytics  
                  │         │          │  
                  └─────────┼──────────┘  
                            │  
                         Checkout  
                            │  
                 ┌──────────┼──────────┐  
                 ▼          ▼          ▼  
               Orders    Payments   Shipping  
                 │  
                 ▼  
             Notifications  
                            │  
                            ▼  
                     ┌─────────────┐  
                     │   Prisma    │  
                     └──────┬──────┘  
                            │  
                     ┌──────▼──────┐  
                     │ PostgreSQL  │  
                     └─────────────┘  
---

# **67\. Phase 2 Deliverables Status**

| Deliverable | Status |
| ----- | ----- |
| High-level architecture | ✅ |
| Modular architecture | ✅ |
| Domain boundaries | ✅ |
| Market architecture | ✅ |
| Pricing architecture | ✅ |
| Inventory architecture | ✅ |
| Order architecture | ✅ |
| Payment architecture | ✅ |
| Shipping architecture | ✅ |
| Authentication architecture | ✅ |
| RBAC architecture | ✅ |
| API architecture | ✅ |
| Database conceptual model | ✅ |
| Next.js structure | ✅ |
| Security architecture | ✅ |
| Caching strategy | ✅ |
| Scalability strategy | ✅ |
| Deployment architecture | ✅ |
| Testing direction | ✅ |

# **Phase 2A — Database Architecture & ERD**

We’ll now go deeper into Phase 2 and design the **PostgreSQL database architecture**. This is the foundation for Prisma, APIs, inventory, pricing, checkout, payments, RBAC, and reporting.

The uploaded specification explicitly requires PostgreSQL \+ Prisma and calls for a relational design covering users, products, markets, pricing, inventory, orders, payments, shipping, promotions, reviews, wishlists, carts, notifications, audit logs, and exchange rates.

The design below follows the earlier architectural decision:

> **One business → multiple markets (Pakistan/UAE), with independent market configuration.**

It is **not** a multi-tenant marketplace architecture.

---

# **1\. Database Architecture Principles**

The database will follow these principles:

1. **Relational modeling**  
2. **Normalization where appropriate**  
3. **Explicit foreign keys**  
4. **Strong database constraints**  
5. **Transaction-safe commerce operations**  
6. **Immutable historical order data**  
7. **Market-aware pricing**  
8. **Variant-level inventory**  
9. **Permission-driven authorization**  
10. **Auditability**  
11. **Indexes based on actual query patterns**  
12. **No unnecessary duplication**  
13. **Extensibility for additional markets**  
14. **No premature microservice-specific databases**

---

# **2\. Domain Database Map**

The database can be divided conceptually into these domains:

┌────────────────────────────────────────────────────────────┐  
│                    IDENTITY & ACCESS                       │  
│ User • Role • Permission • Session                         │  
└───────────────────────────┬────────────────────────────────┘  
                            │  
┌───────────────────────────▼────────────────────────────────┐  
│                         MARKET                             │  
│ Market • MarketSettings • ExchangeRate                     │  
└───────────────────────────┬────────────────────────────────┘  
                            │  
┌───────────────────────────▼────────────────────────────────┐  
│                         CATALOG                            │  
│ Product • Variant • Category • Brand • Images • Attributes │  
└───────────────────────────┬────────────────────────────────┘  
                            │  
             ┌──────────────┴──────────────┐  
             ▼                             ▼  
       MARKET PRICING                 INVENTORY  
       MarketProduct                 Warehouse  
       MarketPrice                   Inventory  
                                     Movements  
             │                             │  
             └──────────────┬──────────────┘  
                            ▼  
┌────────────────────────────────────────────────────────────┐  
│                         COMMERCE                           │  
│ Cart • CartItem • Order • OrderItem • Address              │  
└───────────────┬───────────────────────┬────────────────────┘  
                │                       │  
                ▼                       ▼  
           PAYMENTS                  SHIPPING  
           Payment                  Shipment  
                                    Zone/Method  
                │                       │  
                └───────────┬───────────┘  
                            ▼  
┌────────────────────────────────────────────────────────────┐  
│                    MARKETING & ENGAGEMENT                   │  
│ Promotion • Coupon • Review • Wishlist • Notification       │  
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐  
│                     ADMINISTRATION                          │  
│ AuditLog • Settings • CMS • Analytics                      │  
└────────────────────────────────────────────────────────────┘  
---

# **3\. Identity & Access Model**

## **3.1 User**

Represents anyone who can authenticate into the system.

User  
\----  
id  
email  
passwordHash  
firstName  
lastName  
phone  
status  
emailVerifiedAt  
createdAt  
updatedAt

A customer and an administrator can use the same fundamental identity model.

Their permissions determine what they can access.

---

# **4\. Role**

Role  
\----  
id  
name  
description  
isSystemRole  
createdAt  
updatedAt

Examples:

SUPER\_ADMIN  
ADMIN  
STORE\_MANAGER  
PRODUCT\_MANAGER  
INVENTORY\_MANAGER  
ORDER\_MANAGER  
MARKETING\_MANAGER  
CUSTOMER\_SUPPORT  
CUSTOMER  
---

# **5\. Permission**

Permissions represent individual capabilities.

Permission  
\----------  
id  
key  
name  
description  
module  
createdAt

Examples:

products:create  
products:read  
products:update  
products:archive

orders:read  
orders:update  
orders:cancel  
orders:refund

inventory:read  
inventory:update

customers:read

promotions:create  
promotions:update

`key` should be unique.

---

# **6\. UserRole**

Because a user may potentially have multiple roles:

User  
  │  
  └── UserRole  
          │  
          ▼  
         Role

This provides flexibility beyond a single `roleId` column.

---

# **7\. RolePermission**

Role  
 │  
 └── RolePermission  
          │  
          ▼  
      Permission

This gives us:

Product Manager  
 ├── products:create  
 ├── products:read  
 ├── products:update  
 └── products:archive

instead of hard-coded authorization.

---

# **8\. Session**

A dedicated session model can support secure session management.

Conceptually:

Session  
\-------  
id  
userId  
expiresAt  
createdAt  
updatedAt

Additional security metadata may be introduced later.

---

# **9\. Market Architecture**

This is one of the most important parts of the database.

## **Market**

Market  
\------  
id  
code  
name  
currencyCode  
isActive  
createdAt  
updatedAt

Initial records:

PK → Pakistan → PKR  
AE → UAE      → AED

Future:

SA → Saudi Arabia → SAR  
QA → Qatar        → QAR

The schema does not need restructuring to add them.

---

# **10\. Market Settings**

Avoid putting every possible market configuration directly inside `Market`.

Use a related configuration model where appropriate.

MarketSettings  
\--------------  
id  
marketId  
taxEnabled  
defaultTaxRate  
freeShippingThreshold  
...

Additional settings can be added as actual structured fields when their business semantics become known.

Avoid creating a giant JSON configuration as the primary data model.

---

# **11\. Exchange Rates**

Exchange rates are separate from storefront pricing.

ExchangeRate  
\------------  
id  
baseCurrency  
targetCurrency  
rate  
effectiveAt  
source  
createdAt

Example:

PKR → AED

This is used for:

* reporting  
* analytics  
* financial comparison

It does **not** determine:

Pakistan price → UAE price

This preserves the requirement for independently configured market prices.

---

# **12\. Product Architecture**

## **Product**

Product  
\-------  
id  
name  
slug  
description  
shortDescription  
brandId  
categoryId  
status  
seoTitle  
seoDescription  
createdAt  
updatedAt

Important:

The product itself does not contain:

pakistanPrice  
uaePrice

That would become difficult to maintain as markets grow.

---

# **13\. Category**

Category  
\--------  
id  
parentId  
name  
slug  
description  
image  
status  
sortOrder  
seoTitle  
seoDescription  
createdAt  
updatedAt

`parentId` allows:

Skincare  
 ├── Face Care  
 ├── Body Care  
 └── Hair Care

This means we don't need separate `Category` and `Subcategory` tables unless business requirements later justify them.

---

# **14\. Brand**

Brand  
\-----  
id  
name  
slug  
description  
logo  
status  
createdAt  
updatedAt

A product can optionally belong to a brand.

---

# **15\. Product Variant**

Variants should represent sellable SKU-level items.

ProductVariant  
\--------------  
id  
productId  
sku  
name  
status  
barcode  
weight  
createdAt  
updatedAt

Example:

Shilajit Resin  
│  
├── 20g → SKU SHL-20  
├── 30g → SKU SHL-30  
└── 50g → SKU SHL-50

Inventory operates at this level.

---

# **16\. Product Images**

ProductImage  
\------------  
id  
productId  
variantId nullable  
url  
altText  
sortOrder  
isPrimary  
createdAt

This allows:

* product-level images  
* variant-specific images

---

# **17\. Product Attributes**

Because product categories can differ significantly, we need flexible attribute support.

For example:

Shilajit  
Weight: 20g  
Form: Resin  
Origin: Himalayan

while:

Perfume  
Volume: 100ml  
Fragrance: Oud  
Concentration: Eau de Parfum

A generic attribute architecture can be introduced:

Attribute  
\---------  
id  
name  
slug  
type

and associated product/variant values.

The exact EAV-vs-JSON-vs-relational strategy should be finalized carefully before implementation because overusing EAV can make querying unnecessarily difficult.

---

# **18\. Market Product**

This is the bridge between products and markets.

MarketProduct  
\-------------  
id  
marketId  
productId  
isAvailable  
isVisible  
createdAt  
updatedAt

Example:

Shilajit  
 ├── Pakistan → Visible \+ Available  
 └── UAE      → Visible \+ Available

Product X  
 ├── Pakistan → Visible  
 └── UAE      → Hidden

This directly supports the requirement for market-specific availability and visibility.

---

# **19\. Market Pricing**

Pricing belongs to the **market \+ sellable variant**.

MarketPrice  
\-----------  
id  
marketId  
variantId  
price  
salePrice  
saleStartsAt  
saleEndsAt  
createdAt  
updatedAt

Example:

SHL-20

Pakistan  
price \= PKR 4,999  
salePrice \= PKR 4,499

UAE  
price \= AED 149  
salePrice \= AED 129

This is the correct abstraction for independent market pricing.

---

# **20\. Why Pricing Is Variant-Level**

Consider:

Shilajit  
20g  
30g  
50g

Each may have different prices in each market.

Therefore:

Variant × Market \= Price

rather than:

Product × Market \= Price

This is more accurate for real e-commerce.

---

# **21\. Inventory Architecture**

Inventory should be independent of pricing.

Core entities:

Warehouse  
Inventory  
InventoryMovement  
---

# **22\. Warehouse**

Warehouse  
\---------  
id  
name  
code  
marketId nullable  
addressId nullable  
status  
createdAt  
updatedAt

Even if the business initially has one warehouse, this allows future expansion.

---

# **23\. Inventory**

Inventory  
\---------  
id  
warehouseId  
variantId  
quantity  
reservedQuantity  
lowStockThreshold  
updatedAt

Available stock becomes conceptually:

available \= quantity \- reservedQuantity

This provides room for reservation-based checkout.

---

# **24\. Inventory Movement**

Never simply overwrite inventory without maintaining history.

InventoryMovement  
\-----------------  
id  
inventoryId  
type  
quantity  
referenceType  
referenceId  
reason  
createdBy  
createdAt

Movement types:

PURCHASE  
SALE  
RETURN  
DAMAGE  
ADJUSTMENT  
TRANSFER  
RESERVATION  
RELEASE

This creates an inventory audit trail.

---

# **25\. Inventory Flow**

Purchase  
   ↓  
Inventory \+100

Order  
   ↓  
Reserve 2

Order completed  
   ↓  
Stock finalized

Order cancelled  
   ↓  
Reservation released

The exact reservation timing will be determined by the checkout/payment strategy.

---

# **26\. Customer Model**

Customer-specific information should be separated appropriately from authentication identity.

Conceptually:

User  
 │  
 └── CustomerProfile

Customer profile:

CustomerProfile  
\---------------  
id  
userId  
dateOfBirth nullable  
marketingConsent  
createdAt  
updatedAt

We should avoid collecting personal data that isn't required.

---

# **27\. Address**

Addresses should belong to customers.

Address  
\-------  
id  
userId  
type  
firstName  
lastName  
phone  
addressLine1  
addressLine2  
city  
state  
postalCode  
countryCode  
isDefault  
createdAt  
updatedAt

Possible types:

SHIPPING  
BILLING  
---

# **28\. Critical Order Address Rule**

When an order is created, we should **snapshot the address**.

Why?

Customer could later change:

House 10

to:

House 20

The old order must still contain the historical delivery address.

Therefore order addresses should be immutable snapshots.

---

# **29\. Cart**

Cart  
\----  
id  
userId nullable  
marketId  
status  
expiresAt  
createdAt  
updatedAt

`userId` can be nullable to support guest carts.

---

# **30\. Cart Item**

CartItem  
\--------  
id  
cartId  
variantId  
quantity  
createdAt  
updatedAt

Do not permanently trust cart prices.

At checkout:

Cart  
 ↓  
Recalculate  
 ↓  
Current Market Price  
 ↓  
Promotion  
 ↓  
Shipping  
 ↓  
Tax  
 ↓  
Final Order  
---

# **31\. Order**

The order is the most important commerce entity.

Order  
\-----  
id  
orderNumber  
userId nullable  
marketId  
currencyCode  
status  
paymentStatus  
shipmentStatus  
subtotal  
discountTotal  
shippingTotal  
taxTotal  
grandTotal  
placedAt  
createdAt  
updatedAt  
---

# **32\. Order Number**

Use a human-readable order number separate from the database ID.

Example:

PK-20260914-001245

or:

ORD-2026-0001245

The exact format can be finalized later.

The database primary key can remain an internal UUID.

---

# **33\. Order Item**

OrderItem  
\---------  
id  
orderId  
productId nullable  
variantId nullable  
productName  
variantName  
sku  
unitPrice  
quantity  
discountTotal  
taxTotal  
lineTotal

Notice the snapshots:

productName  
variantName  
sku  
unitPrice

These protect historical order information.

---

# **34\. Order Totals**

The database should retain the financial breakdown:

Subtotal  
\- Discount  
\+ Shipping  
\+ Tax  
\----------------  
Grand Total

This is far better than storing only:

total

because it supports:

* receipts  
* refunds  
* reporting  
* debugging  
* customer transparency

---

# **35\. Order State Model**

Keep these independent:

Order Status  
Payment Status  
Shipment Status

Example:

Order:  
PROCESSING

Payment:  
PAID

Shipment:  
PREPARING

This avoids a giant status enum trying to represent every combination.

---

# **36\. Payment**

Payment  
\-------  
id  
orderId  
provider  
method  
status  
amount  
currencyCode  
providerPaymentId  
paidAt  
createdAt  
updatedAt

Potential methods:

CARD  
COD  
BANK\_TRANSFER  
DIGITAL\_WALLET

The actual available methods depend on the market.

---

# **37\. Payment Transaction**

For providers that produce multiple events/attempts, introduce:

PaymentTransaction  
\------------------  
id  
paymentId  
type  
status  
amount  
providerReference  
metadata  
createdAt

This gives us a history rather than overwriting payment state.

---

# **38\. Payment Provider Abstraction**

Database:

Payment  
   │  
   └── provider \= PROVIDER\_X

Application:

PaymentService  
      │  
      ├── ProviderXAdapter  
      ├── ProviderYAdapter  
      └── CODAdapter

This follows the requirement to avoid hard-coding the platform to one provider.

---

# **39\. Shipment**

Shipment  
\--------  
id  
orderId  
shippingMethodId  
trackingNumber  
status  
carrier  
shippedAt  
deliveredAt  
createdAt  
updatedAt

Possible statuses:

PENDING  
PROCESSING  
SHIPPED  
IN\_TRANSIT  
OUT\_FOR\_DELIVERY  
DELIVERED  
FAILED  
RETURNED  
---

# **40\. Shipping Zone**

ShippingZone  
\------------  
id  
marketId  
name  
description  
status

Example:

Pakistan  
 ├── Lahore  
 ├── Karachi  
 ├── Islamabad  
 └── Other  
---

# **41\. Shipping Method**

ShippingMethod  
\--------------  
id  
marketId  
name  
description  
baseRate  
freeShippingThreshold  
estimatedMinDays  
estimatedMaxDays  
isActive

Later, more advanced rules can be introduced.

---

# **42\. Shipping Calculation**

Conceptually:

Market  
 \+  
Address  
 \+  
Order Value  
 \+  
Shipping Method  
        ↓  
Shipping Cost

The server calculates the actual shipping amount.

---

# **43\. Promotions**

A promotion is the business rule.

Promotion  
\---------  
id  
name  
type  
status  
marketId nullable  
startsAt  
endsAt  
priority  
usageLimit  
createdAt  
updatedAt

Types may include:

PERCENTAGE  
FIXED  
BUY\_X\_GET\_Y  
FREE\_SHIPPING  
---

# **44\. Coupon**

Coupon is the customer-facing code.

Coupon  
\------  
id  
promotionId  
code  
usageLimit  
perCustomerLimit  
minimumOrderAmount  
startsAt  
endsAt  
isActive

Example:

WELCOME10

can point to:

10% discount promotion  
---

# **45\. Coupon Usage**

CouponUsage  
\-----------  
id  
couponId  
userId  
orderId  
discountAmount  
usedAt

This supports:

* usage tracking  
* per-customer limits  
* fraud prevention  
* reporting

---

# **46\. Wishlist**

Wishlist  
\--------  
id  
userId  
createdAt  
updatedAt  
WishlistItem  
\------------  
id  
wishlistId  
productId  
createdAt

Unique constraint:

wishlistId \+ productId

so the same product cannot be added twice.

---

# **47\. Reviews**

Review  
\------  
id  
productId  
userId  
orderId nullable  
rating  
title  
content  
status  
createdAt  
updatedAt

The optional `orderId` allows future support for:

Verified Purchase

without requiring a separate review system.

---

# **48\. Notifications**

Notification  
\------------  
id  
userId  
type  
title  
message  
readAt  
createdAt

Potential notification types:

ORDER\_CREATED  
ORDER\_UPDATED  
PAYMENT\_SUCCESS  
PAYMENT\_FAILED  
SHIPMENT\_UPDATED  
LOW\_STOCK  
PROMOTION  
---

# **49\. Audit Log**

Audit logs are particularly important for administrative actions.

AuditLog  
\--------  
id  
userId  
action  
entityType  
entityId  
before  
after  
ipAddress nullable  
userAgent nullable  
createdAt

Example:

User: Admin  
Action: UPDATE\_PRODUCT\_PRICE  
Entity: MarketPrice  
Before: 4999  
After: 4499

The exact storage of before/after data should be designed carefully to avoid leaking sensitive information.

---

# **50\. CMS / Content**

For homepage and marketing content:

Banner  
\------  
id  
marketId nullable  
title  
subtitle  
image  
link  
status  
startsAt  
endsAt  
sortOrder

This allows:

Pakistan Homepage

and:

UAE Homepage

to display different campaigns.

---

# **51\. FAQ**

FAQ  
\---  
id  
marketId nullable  
question  
answer  
status  
sortOrder  
---

# **52\. Entity Relationship Diagram**

High-level ERD:

                          ┌────────────┐  
                           │    User    │  
                           └─────┬──────┘  
                                 │  
               ┌─────────────────┼──────────────────┐  
               │                 │                  │  
               ▼                 ▼                  ▼  
            UserRole         CustomerProfile      Address  
               │  
               ▼  
              Role  
               │  
               ▼  
         RolePermission  
               │  
               ▼  
          Permission

                        ┌─────────────┐  
                        │   Market    │  
                        └──────┬──────┘  
                               │  
              ┌────────────────┼─────────────────┐  
              │                │                 │  
              ▼                ▼                 ▼  
       MarketProduct      MarketPrice      ShippingZone  
              │                │                 │  
              │                ▼                 ▼  
              │             Variant       ShippingMethod  
              │                │  
              │                │  
        ┌─────▼─────┐          │  
        │  Product  │──────────┘  
        └─────┬─────┘  
              │  
       ┌──────┼────────┐  
       ▼      ▼        ▼  
   Category  Brand   ProductImage  
              │  
              ▼  
           Variant  
              │  
              ▼  
          Inventory  
              │  
              ▼  
     InventoryMovement

 User  
  │  
  ├── Cart  
  │     └── CartItem ──► Variant  
  │  
  ├── Wishlist  
  │     └── WishlistItem ──► Product  
  │  
  └── Order  
         │  
         ├── OrderItem ──► Product/Variant  
         │  
         ├── Payment  
         │  
         └── Shipment  
                   │  
                   └── ShippingMethod  
---

# **53\. Complete Conceptual Schema**

The resulting database is approximately:

IDENTITY  
\--------  
users  
roles  
permissions  
user\_roles  
role\_permissions  
sessions

MARKET  
\------  
markets  
market\_settings  
exchange\_rates

CATALOG  
\-------  
products  
product\_variants  
categories  
brands  
product\_images  
attributes  
product\_attribute\_values

PRICING  
\-------  
market\_products  
market\_prices

INVENTORY  
\---------  
warehouses  
inventory  
inventory\_movements

CUSTOMERS  
\---------  
customer\_profiles  
addresses

COMMERCE  
\--------  
carts  
cart\_items  
orders  
order\_items

PAYMENTS  
\--------  
payments  
payment\_transactions

SHIPPING  
\--------  
shipping\_zones  
shipping\_methods  
shipments

MARKETING  
\---------  
promotions  
coupons  
coupon\_usages

ENGAGEMENT  
\----------  
wishlists  
wishlist\_items  
reviews  
notifications

CONTENT  
\-------  
banners  
faqs

ADMIN  
\-----  
audit\_logs  
---

# **54\. Primary Keys**

I recommend using **UUIDs** for internal primary keys.

Example:

id UUID PRIMARY KEY

Advantages:

* globally unique  
* safer for distributed systems  
* avoids sequential IDs being easily enumerable  
* suitable for future service extraction

Human-facing identifiers such as order numbers should remain separate.

---

# **55\. Foreign Keys**

Important relationships:

product\_variants.product\_id  
→ products.id

market\_products.market\_id  
→ markets.id

market\_products.product\_id  
→ products.id

market\_prices.market\_id  
→ markets.id

market\_prices.variant\_id  
→ product\_variants.id

inventory.variant\_id  
→ product\_variants.id

inventory.warehouse\_id  
→ warehouses.id

orders.user\_id  
→ users.id

orders.market\_id  
→ markets.id

order\_items.order\_id  
→ orders.id

Foreign keys should be enforced at the PostgreSQL level.

---

# **56\. Critical Unique Constraints**

Examples:

users.email  
products.slug  
product\_variants.sku  
markets.code  
permissions.key  
categories.slug

Composite unique constraints:

market\_products:  
(marketId, productId)

market\_prices:  
(marketId, variantId)

inventory:  
(warehouseId, variantId)

wishlist\_items:  
(wishlistId, productId)  
---

# **57\. Important Indexes**

Indexes should be created based on expected queries.

### **Users**

email

### **Products**

slug  
status  
brandId  
categoryId

### **Variants**

sku  
productId

### **Market Products**

marketId \+ productId  
marketId \+ isVisible

### **Prices**

marketId \+ variantId

### **Orders**

orderNumber  
userId  
marketId  
status  
createdAt

### **Inventory**

warehouseId \+ variantId

### **Coupons**

code

These will be refined against actual query patterns.

---

# **58\. Delete Rules**

We should **not use cascading deletion everywhere**.

For example:

Deleting a user should not automatically destroy:

Orders  
Payments  
Audit logs

Historical business data must remain intact.

For many business entities, prefer:

status \= ARCHIVED

over physical deletion.

---

# **59\. Soft Delete vs Archive**

Use archival for:

* Products  
* Categories  
* Brands  
* Promotions  
* Shipping methods  
* Users where appropriate

Be especially conservative with:

* Orders  
* Payments  
* Inventory movements  
* Audit logs

These should generally remain historically available.

---

# **60\. Transaction Boundaries**

Some operations must be transactional.

## **Checkout**

Conceptually:

BEGIN

Validate Cart  
Validate Market  
Validate Prices  
Validate Promotion  
Validate Inventory

Create Order  
Create Order Items  
Create Payment Record  
Reserve/Update Inventory

COMMIT

If a critical operation fails:

ROLLBACK  
---

# **61\. Payment Transaction**

Payment confirmation should also be safely processed.

BEGIN

Validate webhook  
Find payment  
Check idempotency  
Update payment  
Update order  
Update inventory if required

COMMIT

Exact inventory timing depends on the final payment/order strategy.

---

# **62\. Idempotency Database Support**

Critical requests should have an idempotency mechanism.

A future model can be:

IdempotencyKey  
\-------------  
id  
key  
operation  
userId  
requestHash  
response  
createdAt  
expiresAt

This is particularly useful for:

* checkout  
* payment creation  
* webhook processing  
* refunds

---

# **63\. Data Ownership**

Each module should conceptually own its data.

Catalog → Product data  
Pricing → Price data  
Inventory → Stock data  
Orders → Commercial transaction  
Payments → Payment records  
Shipping → Shipment records  
RBAC → Authorization

This prevents business logic from becoming tightly coupled.

---

# **64\. Data Flow — Product**

Admin  
 ↓  
Create Product  
 ↓  
Product  
 ↓  
Add Variants  
 ↓  
Assign Market  
 ↓  
Configure Market Price  
 ↓  
Configure Inventory  
 ↓  
Publish  
 ↓  
Storefront  
---

# **65\. Data Flow — Customer Purchase**

Customer  
 ↓  
Market Selection  
 ↓  
Product  
 ↓  
Variant  
 ↓  
MarketPrice  
 ↓  
Cart  
 ↓  
Checkout  
 ↓  
Server Recalculation  
 ↓  
Inventory Validation  
 ↓  
Promotion Validation  
 ↓  
Shipping Calculation  
 ↓  
Order  
 ↓  
Payment  
 ↓  
Shipment  
---

# **66\. Data Flow — Admin Price Change**

Admin  
 ↓  
Permission Check  
 ↓  
MarketPrice Update  
 ↓  
Database Transaction  
 ↓  
AuditLog  
 ↓  
Cache Invalidation  
 ↓  
New Storefront Price

This is especially important because pricing is a sensitive business operation.

---

# **67\. Data Flow — Inventory Adjustment**

Inventory Manager  
       ↓  
Permission Check  
       ↓  
Select SKU  
       ↓  
Enter Adjustment  
       ↓  
Database Transaction  
       ├── Update Inventory  
       └── Create InventoryMovement  
              ↓  
          Audit Context

Inventory history should never disappear simply because the current quantity changed.

---

# **68\. Reporting Considerations**

The transactional schema should remain normalized.

For MVP:

Reports  
   ↓  
PostgreSQL  
   ↓  
Aggregated Queries

As volume grows:

PostgreSQL  
    ↓  
Events / Aggregation  
    ↓  
Analytics Database

There is no need to introduce a data warehouse now.

---

# **69\. Prisma Architecture**

Prisma should represent the relational model rather than becoming the business architecture itself.

Conceptually:

Prisma  
   │  
   ├── Models  
   ├── Relations  
   ├── Constraints  
   └── Migrations

Business logic remains in domain services.

Avoid putting complex commerce logic directly inside random Prisma calls scattered throughout components.

---

# **70\. Prisma Layer**

Recommended conceptual flow:

API / Server Action  
        ↓  
Application Service  
        ↓  
Domain Service  
        ↓  
Repository / Data Access  
        ↓  
Prisma  
        ↓  
PostgreSQL

For simpler operations, some layers can be collapsed where appropriate; the goal is **clear responsibility**, not architecture for architecture's sake.

---

# **71\. Final Database Architecture**

The core model is:

                    BUSINESS  
                         │  
             ┌───────────┴───────────┐  
             ▼                       ▼  
         Pakistan                   UAE  
          Market                   Market  
             │                       │  
             └───────────┬───────────┘  
                         │  
                       Product  
                         │  
                       Variant  
                         │  
                ┌────────┴────────┐  
                ▼                 ▼  
           Market Price       Inventory  
                │                 │  
                └────────┬────────┘  
                         ▼  
                       Cart  
                         │  
                         ▼  
                      Checkout  
                         │  
                         ▼  
                       Order  
                    ┌────┼────┐  
                    ▼    ▼    ▼  
                 Payment Shipment Customer

This gives us the right foundation for:

* Pakistan/UAE independent pricing  
* future markets  
* variant-level inventory  
* multi-warehouse expansion  
* secure checkout  
* payment abstraction  
* shipping abstraction  
* granular RBAC  
* historical order integrity  
* auditability  
* analytics

---

# **72\. Phase 2A Status**

| Area | Status |
| ----- | ----- |
| Database principles | ✅ |
| Domain decomposition | ✅ |
| Identity model | ✅ |
| RBAC model | ✅ |
| Market model | ✅ |
| Currency model | ✅ |
| Exchange rates | ✅ |
| Product model | ✅ |
| Variant model | ✅ |
| Category model | ✅ |
| Market pricing | ✅ |
| Inventory | ✅ |
| Warehouses | ✅ |
| Customers | ✅ |
| Addresses | ✅ |
| Cart | ✅ |
| Orders | ✅ |
| Payments | ✅ |
| Shipping | ✅ |
| Promotions | ✅ |
| Coupons | ✅ |
| Reviews | ✅ |
| Wishlist | ✅ |
| Notifications | ✅ |
| Audit logs | ✅ |
| CMS/content | ✅ |
| Relationships | ✅ |
| Constraints | ✅ |
| Index strategy | ✅ |
| Transactions | ✅ |
| Idempotency direction | ✅ |
| Prisma architecture | ✅ |

Absolutely. We’ll combine both so the database specification and the API contract are designed together rather than treating them as isolated layers.

# **Phase 2B — Exact Prisma Schema & Database Specification**

## **2B.1 Database Stack**

**Database:** PostgreSQL  
**ORM:** Prisma  
**Primary keys:** UUID  
**Timestamps:** UTC  
**Money:** `Decimal`, never floating-point  
**Soft deletion:** status/archive where historical data matters  
**Transactions:** Prisma `$transaction()` for critical commerce operations.

### **Core conventions**

id              UUID  
createdAt       DateTime  
updatedAt       DateTime  
deletedAt       DateTime?   // only where appropriate

For monetary values:

Decimal(12,2)

For quantities:

Decimal(12,3)

This allows fractional quantities if required later.

---

# **2B.2 Prisma Enums**

These should be centralized rather than storing arbitrary strings.

### **User**

UserStatus  
\- ACTIVE  
\- INACTIVE  
\- SUSPENDED

### **Product**

ProductStatus  
\- DRAFT  
\- ACTIVE  
\- ARCHIVED

### **Order**

OrderStatus  
\- PENDING  
\- CONFIRMED  
\- PROCESSING  
\- SHIPPED  
\- DELIVERED  
\- CANCELLED  
\- COMPLETED

### **Payment**

PaymentStatus  
\- PENDING  
\- AUTHORIZED  
\- PAID  
\- FAILED  
\- REFUNDED  
\- PARTIALLY\_REFUNDED  
\- CANCELLED

### **Shipment**

ShipmentStatus  
\- PENDING  
\- PROCESSING  
\- SHIPPED  
\- IN\_TRANSIT  
\- DELIVERED  
\- RETURNED  
\- CANCELLED

### **Inventory**

InventoryMovementType  
\- PURCHASE  
\- SALE  
\- RETURN  
\- DAMAGE  
\- ADJUSTMENT  
\- TRANSFER  
\- RESERVATION  
\- RELEASE

### **Promotion**

PromotionType  
\- PERCENTAGE  
\- FIXED\_AMOUNT  
\- FREE\_SHIPPING

### **General status**

Use dedicated enums where behavior differs rather than one giant universal `Status` enum.

---

# **2B.3 Identity & Access Schema**

## **User**

User  
├── id  
├── email UNIQUE  
├── passwordHash  
├── firstName  
├── lastName  
├── phone?  
├── status  
├── emailVerifiedAt?  
├── createdAt  
└── updatedAt

Relations:

User 1 → many UserRole  
User 1 → many Session  
User 1 → 1 CustomerProfile  
User 1 → many Address  
User 1 → many Order  
User 1 → many Review  
User 1 → many Notification  
---

## **Role**

Role  
├── id  
├── name UNIQUE  
├── description?  
├── isSystemRole  
├── createdAt  
└── updatedAt

## **Permission**

Permission  
├── id  
├── key UNIQUE  
├── name  
├── description?  
├── module  
└── createdAt

Examples:

product.create  
product.update  
product.delete  
order.view  
order.update  
inventory.view  
inventory.update  
user.manage  
report.view

## **UserRole**

UserRole  
├── userId  
└── roleId

Unique:

(userId, roleId)

## **RolePermission**

RolePermission  
├── roleId  
└── permissionId

Unique:

(roleId, permissionId)  
---

# **2B.4 Session**

Session  
├── id  
├── userId  
├── expiresAt  
├── createdAt  
└── updatedAt

Index:

userId  
expiresAt

Sessions should be server-managed and represented to the browser through secure cookies.

---

# **2B.5 Market Schema**

The business can operate in multiple markets.

Example:

Business  
 ├── Pakistan → PKR  
 ├── UAE      → AED  
 └── Saudi    → SAR

This is **not multi-tenant architecture**.

## **Market**

Market  
├── id  
├── code UNIQUE  
├── name  
├── currencyCode  
├── isActive  
├── createdAt  
└── updatedAt

Examples:

PK  
AE  
SA  
QA  
---

## **MarketSettings**

MarketSettings  
├── id  
├── marketId UNIQUE  
├── taxEnabled  
├── defaultTaxRate  
├── freeShippingThreshold?  
├── createdAt  
└── updatedAt

Avoid making the entire configuration an unstructured JSON blob.

---

## **ExchangeRate**

ExchangeRate  
├── id  
├── baseCurrency  
├── targetCurrency  
├── rate  
├── effectiveAt  
├── source?  
└── createdAt

Important:

> Exchange rates are for reporting/conversion purposes. They should not silently change storefront prices.

---

# **2B.6 Catalog**

## **Product**

Product  
├── id  
├── name  
├── slug UNIQUE  
├── description?  
├── shortDescription?  
├── brandId?  
├── categoryId?  
├── status  
├── seoTitle?  
├── seoDescription?  
├── createdAt  
└── updatedAt  
---

## **ProductVariant**

ProductVariant  
├── id  
├── productId  
├── sku UNIQUE  
├── name?  
├── barcode?  
├── weight?  
├── status  
├── createdAt  
└── updatedAt

Example:

Product  
  Shilajit Resin

Variants  
  10g  
  20g  
  30g

Inventory and pricing operate at this level.

---

# **2B.7 Category**

Category  
├── id  
├── parentId?  
├── name  
├── slug UNIQUE  
├── description?  
├── image?  
├── status  
├── sortOrder  
├── seoTitle?  
├── seoDescription?  
├── createdAt  
└── updatedAt

Self relation:

Category  
   ↓  
Subcategory  
   ↓  
Sub-subcategory  
---

# **2B.8 Brand**

Brand  
├── id  
├── name  
├── slug UNIQUE  
├── description?  
├── logo?  
├── status  
├── createdAt  
└── updatedAt  
---

# **2B.9 Product Images**

ProductImage  
├── id  
├── productId  
├── variantId?  
├── url  
├── altText?  
├── sortOrder  
├── isPrimary  
└── createdAt

One image can belong to the product generally or a specific variant.

---

# **2B.10 Attributes**

Use relational modeling for important searchable/filterable attributes.

Attribute  
├── id  
├── name  
├── key UNIQUE  
└── type

Possible types:

TEXT  
NUMBER  
BOOLEAN  
SELECT  
MULTI\_SELECT

Then:

ProductAttributeValue  
├── productId  
├── attributeId  
└── value

And, if variant-specific attributes are required:

VariantAttributeValue  
├── variantId  
├── attributeId  
└── value

Avoid an uncontrolled EAV design for everything.

---

# **2B.11 Market Product**

MarketProduct  
├── id  
├── marketId  
├── productId  
├── isAvailable  
├── isVisible  
├── createdAt  
└── updatedAt

Unique:

(marketId, productId)

This controls whether a product appears in a specific market.

---

# **2B.12 Market Price**

MarketPrice  
├── id  
├── marketId  
├── variantId  
├── price  
├── salePrice?  
├── saleStartsAt?  
├── saleEndsAt?  
├── createdAt  
└── updatedAt

Unique:

(marketId, variantId)

Example:

10g Shilajit

Pakistan → PKR 2,500  
UAE      → AED 120  
---

# **2B.13 Inventory**

## **Warehouse**

Warehouse  
├── id  
├── name  
├── code UNIQUE  
├── marketId?  
├── addressId?  
├── status  
├── createdAt  
└── updatedAt  
---

## **Inventory**

Inventory  
├── id  
├── warehouseId  
├── variantId  
├── quantity  
├── reservedQuantity  
├── lowStockThreshold  
└── updatedAt

Unique:

(warehouseId, variantId)

Available quantity:

available \= quantity \- reservedQuantity  
---

## **InventoryMovement**

InventoryMovement  
├── id  
├── inventoryId  
├── type  
├── quantity  
├── referenceType?  
├── referenceId?  
├── reason?  
├── createdBy?  
└── createdAt

This creates the inventory audit trail.

---

# **2B.14 Customer**

CustomerProfile  
├── id  
├── userId UNIQUE  
├── dateOfBirth?  
├── marketingConsent  
├── createdAt  
└── updatedAt  
---

# **2B.15 Address**

Address  
├── id  
├── userId  
├── type  
├── firstName  
├── lastName  
├── phone  
├── addressLine1  
├── addressLine2?  
├── city  
├── state?  
├── postalCode?  
├── countryCode  
├── isDefault  
├── createdAt  
└── updatedAt

**Important:** orders must not depend on the customer's current address.

At checkout, copy the address into an order-address snapshot.

---

# **2B.16 Cart**

Cart  
├── id  
├── userId?  
├── marketId  
├── status  
├── expiresAt?  
├── createdAt  
└── updatedAt

## **CartItem**

CartItem  
├── id  
├── cartId  
├── variantId  
├── quantity  
├── createdAt  
└── updatedAt

Unique:

(cartId, variantId)  
---

# **2B.17 Orders**

## **Order**

Order  
├── id UUID  
├── orderNumber UNIQUE  
├── userId?  
├── marketId  
├── currencyCode  
├── status  
├── paymentStatus  
├── shipmentStatus  
├── subtotal  
├── discountTotal  
├── shippingTotal  
├── taxTotal  
├── grandTotal  
├── placedAt?  
├── createdAt  
└── updatedAt

Human-facing:

SHJ-2026-000123

Internal:

UUID  
---

## **OrderItem**

OrderItem  
├── id  
├── orderId  
├── productId?  
├── variantId?  
├── productName  
├── variantName?  
├── sku  
├── unitPrice  
├── quantity  
├── discountTotal  
├── taxTotal  
└── lineTotal

The product information is intentionally duplicated.

Why?

Because if the product is renamed tomorrow:

Old order → must still show old name

Historical commerce data should be immutable.

---

# **2B.18 Order Address Snapshot**

Recommended dedicated model:

OrderAddress  
├── id  
├── orderId  
├── type  
├── firstName  
├── lastName  
├── phone  
├── addressLine1  
├── addressLine2?  
├── city  
├── state?  
├── postalCode?  
└── countryCode

This protects historical order data.

---

# **2B.19 Payments**

## **Payment**

Payment  
├── id  
├── orderId  
├── provider  
├── method  
├── status  
├── amount  
├── currencyCode  
├── providerPaymentId?  
├── paidAt?  
├── createdAt  
└── updatedAt

Never store:

CVV  
Raw card number  
Sensitive authentication data  
---

## **PaymentTransaction**

PaymentTransaction  
├── id  
├── paymentId  
├── type  
├── status  
├── amount  
├── providerReference?  
├── metadata?  
└── createdAt

Examples:

AUTHORIZATION  
CAPTURE  
REFUND  
VOID  
---

# **2B.20 Shipping**

## **ShippingZone**

ShippingZone  
├── id  
├── marketId  
├── name  
├── description?  
├── status  
└── createdAt

## **ShippingMethod**

ShippingMethod  
├── id  
├── marketId  
├── name  
├── description?  
├── baseRate  
├── freeShippingThreshold?  
├── estimatedMinDays?  
├── estimatedMaxDays?  
├── isActive  
├── createdAt  
└── updatedAt

## **Shipment**

Shipment  
├── id  
├── orderId  
├── shippingMethodId  
├── trackingNumber?  
├── carrier?  
├── status  
├── shippedAt?  
├── deliveredAt?  
├── createdAt  
└── updatedAt  
---

# **2B.21 Promotions**

## **Promotion**

Promotion  
├── id  
├── name  
├── type  
├── status  
├── marketId?  
├── startsAt?  
├── endsAt?  
├── priority  
├── usageLimit?  
├── createdAt  
└── updatedAt

## **Coupon**

Coupon  
├── id  
├── promotionId  
├── code UNIQUE  
├── usageLimit?  
├── perCustomerLimit?  
├── minimumOrderAmount?  
├── startsAt?  
├── endsAt?  
├── isActive  
└── createdAt

## **CouponUsage**

CouponUsage  
├── id  
├── couponId  
├── userId?  
├── orderId  
├── discountAmount  
└── usedAt  
---

# **2B.22 Wishlist**

Wishlist  
├── id  
├── userId UNIQUE  
├── createdAt  
└── updatedAt  
WishlistItem  
├── id  
├── wishlistId  
├── productId  
└── createdAt

Unique:

(wishlistId, productId)  
---

# **2B.23 Reviews**

Review  
├── id  
├── productId  
├── userId  
├── orderId?  
├── rating  
├── title?  
├── content  
├── status  
├── createdAt  
└── updatedAt

`orderId` can support verified-purchase reviews.

---

# **2B.24 Notifications**

Notification  
├── id  
├── userId  
├── type  
├── title  
├── message  
├── readAt?  
└── createdAt  
---

# **2B.25 CMS**

## **Banner**

Banner  
├── id  
├── marketId?  
├── title  
├── subtitle?  
├── image  
├── link?  
├── status  
├── startsAt?  
├── endsAt?  
├── sortOrder  
└── createdAt

## **FAQ**

FAQ  
├── id  
├── marketId?  
├── question  
├── answer  
├── status  
├── sortOrder  
└── createdAt  
---

# **2B.26 Audit Logs**

AuditLog  
├── id  
├── userId?  
├── action  
├── entityType  
├── entityId  
├── before?  
├── after?  
├── ipAddress?  
├── userAgent?  
└── createdAt

Use carefully so sensitive information isn't copied into audit records.

---

# **2B.27 Idempotency**

For operations such as:

Checkout  
Payment creation  
Payment webhook  
Refund

create:

IdempotencyKey  
├── id  
├── key  
├── operation  
├── userId?  
├── requestHash  
├── response?  
├── createdAt  
└── expiresAt

Unique:

(key, operation)

This prevents duplicate operations when clients retry requests.

---

# **2B.28 Critical Database Constraints**

The database should enforce important invariants rather than trusting application code alone.

Examples:

email UNIQUE  
SKU UNIQUE  
slug UNIQUE  
market.code UNIQUE  
coupon.code UNIQUE

Composite:

MarketProduct(marketId, productId)  
MarketPrice(marketId, variantId)  
Inventory(warehouseId, variantId)  
WishlistItem(wishlistId, productId)  
UserRole(userId, roleId)  
RolePermission(roleId, permissionId)  
---

# **2B.29 Delete Strategy**

### **Safe to archive**

Products  
Categories  
Brands  
Promotions  
Shipping methods  
Users

### **Do NOT casually delete**

Orders  
OrderItems  
Payments  
PaymentTransactions  
InventoryMovements  
AuditLogs

Commerce history must remain auditable.

---

# **2B.30 Transaction Boundaries**

### **Checkout**

BEGIN

Validate cart  
↓  
Validate market  
↓  
Validate prices  
↓  
Validate promotion  
↓  
Validate inventory  
↓  
Create order  
↓  
Create order items  
↓  
Create order address snapshot  
↓  
Reserve inventory  
↓  
Create payment  
↓  
COMMIT

Any failure:

ROLLBACK

### **Payment webhook**

Receive webhook  
↓  
Verify signature  
↓  
Check idempotency  
↓  
Find payment  
↓  
Validate expected state  
↓  
Update payment  
↓  
Update order  
↓  
Update inventory/shipment where applicable  
↓  
COMMIT  
---

# **Phase 2C — API Architecture & Contracts**

Now we expose the database/domain through a clean application API.

## **2C.1 API Philosophy**

The API should be:

Resource-oriented  
Versioned  
Authenticated  
Validated  
Permission-controlled  
Idempotent where necessary  
Transaction-safe  
Consistent in response format

Recommended base:

/api/v1  
---

# **2C.2 High-Level Request Flow**

Client  
  ↓  
Next.js Route Handler / API  
  ↓  
Request Validation  
  ↓  
Authentication  
  ↓  
Authorization  
  ↓  
Application Service  
  ↓  
Domain Service  
  ↓  
Repository / Data Access  
  ↓  
Prisma  
  ↓  
PostgreSQL

For simple operations, some layers can be collapsed.

Do **not** create meaningless abstractions just for architecture diagrams.

---

# **2C.3 API Modules**

Recommended API domains:

/api/v1/auth  
/api/v1/users  
/api/v1/roles  
/api/v1/permissions

/api/v1/markets

/api/v1/products  
/api/v1/categories  
/api/v1/brands  
/api/v1/attributes

/api/v1/inventory

/api/v1/carts  
/api/v1/checkout  
/api/v1/orders

/api/v1/payments  
/api/v1/webhooks

/api/v1/shipping

/api/v1/promotions  
/api/v1/coupons

/api/v1/wishlist  
/api/v1/reviews

/api/v1/notifications

/api/v1/banners  
/api/v1/faqs

/api/v1/admin  
/api/v1/audit-logs  
---

# **2C.4 Authentication API**

### **Register**

POST /api/v1/auth/register

Request:

{  
  "email": "customer@example.com",  
  "password": "StrongPassword123\!",  
  "firstName": "John",  
  "lastName": "Doe"  
}

Response:

{  
  "success": true,  
  "data": {  
    "user": {  
      "id": "...",  
      "email": "customer@example.com",  
      "firstName": "John",  
      "lastName": "Doe"  
    }  
  }  
}  
---

### **Login**

POST /api/v1/auth/login

Server creates a session.

Browser receives:

Secure  
HttpOnly  
SameSite

cookie.

---

### **Logout**

POST /api/v1/auth/logout  
---

### **Current user**

GET /api/v1/auth/me  
---

# **2C.5 Product API**

### **Product listing**

GET /api/v1/products

Supported query parameters:

market  
category  
brand  
search  
minPrice  
maxPrice  
sort  
page  
limit

Example:

GET /api/v1/products?market=PK\&category=shilajit\&page=1\&limit=20  
---

### **Product detail**

GET /api/v1/products/:slug

Response should contain:

Product  
Variants  
Images  
Available price  
Market availability  
Relevant attributes  
---

### **Admin create**

POST /api/v1/products

Permission:

product.create  
---

### **Update**

PATCH /api/v1/products/:id

Permission:

product.update  
---

### **Archive**

DELETE /api/v1/products/:id

Internally this should generally mean:

status \= ARCHIVED

rather than physically deleting the record.

---

# **2C.6 Category API**

GET    /api/v1/categories  
GET    /api/v1/categories/:slug  
POST   /api/v1/categories  
PATCH  /api/v1/categories/:id  
DELETE /api/v1/categories/:id  
---

# **2C.7 Market API**

GET /api/v1/markets  
GET /api/v1/markets/:code

Admin:

POST  /api/v1/markets  
PATCH /api/v1/markets/:id

Market context should be determined consistently.

For example:

market=PK

or through the user's selected market/session.

Do not let arbitrary client input override authorization or business rules.

---

# **2C.8 Pricing API**

Pricing should **not** be independently trusted from the browser.

Admin:

PUT /api/v1/markets/:marketId/variants/:variantId/price

Customer:

GET /api/v1/products/:slug

gets the applicable price.

At checkout:

Server recalculates price

Never:

Browser sends total \= 2500  
Server accepts 2500

Instead:

Browser sends variant \+ quantity  
↓  
Server retrieves current price  
↓  
Server calculates subtotal  
↓  
Server applies promotions  
↓  
Server calculates tax/shipping  
↓  
Server produces total  
---

# **2C.9 Cart API**

GET    /api/v1/cart  
POST   /api/v1/cart/items  
PATCH  /api/v1/cart/items/:id  
DELETE /api/v1/cart/items/:id  
DELETE /api/v1/cart

Example:

POST /api/v1/cart/items

{  
  "variantId": "uuid",  
  "quantity": 2  
}

Server validates:

Variant exists  
↓  
Product available  
↓  
Market available  
↓  
Quantity valid  
---

# **2C.10 Checkout API**

This is one of the most important APIs.

POST /api/v1/checkout

Request:

{  
  "shippingAddressId": "uuid",  
  "shippingMethodId": "uuid",  
  "paymentMethod": "COD",  
  "couponCode": "WELCOME10"  
}

Server:

Authenticate  
↓  
Validate request  
↓  
Load cart  
↓  
Determine market  
↓  
Load current prices  
↓  
Validate inventory  
↓  
Validate coupon  
↓  
Calculate tax  
↓  
Calculate shipping  
↓  
Calculate final total  
↓  
Create order transactionally  
↓  
Reserve/decrement inventory  
↓  
Create payment  
↓  
Return order/payment state

Use an idempotency key.

Idempotency-Key: checkout-unique-key  
---

# **2C.11 Order API**

Customer:

GET /api/v1/orders  
GET /api/v1/orders/:id

Admin:

GET /api/v1/admin/orders  
GET /api/v1/admin/orders/:id  
PATCH /api/v1/admin/orders/:id/status

Filtering:

status  
paymentStatus  
shipmentStatus  
market  
dateFrom  
dateTo  
customer  
orderNumber  
---

# **2C.12 Payment API**

POST /api/v1/payments  
GET  /api/v1/payments/:id  
POST /api/v1/payments/:id/refund

But payment creation depends heavily on the payment provider.

Therefore use:

PaymentProvider

interface.

Conceptually:

PaymentProvider  
├── createPayment()  
├── verifyPayment()  
├── refundPayment()  
└── handleWebhook()

Providers can then be implemented independently.

Provider A  
Provider B  
Provider C

The rest of the application does not depend on provider-specific code.

---

# **2C.13 Payment Webhooks**

Example:

POST /api/v1/webhooks/payments/provider-a

Important:

**Never trust the frontend redirect as proof of payment.**

Webhook flow:

Provider  
 ↓  
Webhook  
 ↓  
Verify signature  
 ↓  
Check event ID/idempotency  
 ↓  
Find payment  
 ↓  
Validate amount/currency/order  
 ↓  
Update payment  
 ↓  
Update order  
 ↓  
Trigger required fulfillment  
---

# **2C.14 Shipping API**

Customer:

GET /api/v1/shipping/methods

Admin:

GET    /api/v1/shipping/methods  
POST   /api/v1/shipping/methods  
PATCH  /api/v1/shipping/methods/:id  
DELETE /api/v1/shipping/methods/:id

Shipment:

GET /api/v1/orders/:orderId/shipment  
PATCH /api/v1/admin/shipments/:id  
---

# **2C.15 Inventory API**

Admin:

GET /api/v1/inventory  
GET /api/v1/inventory/:variantId  
POST /api/v1/inventory/adjustments  
POST /api/v1/inventory/transfers  
GET /api/v1/inventory/movements

Example adjustment:

{  
  "warehouseId": "uuid",  
  "variantId": "uuid",  
  "quantity": 10,  
  "reason": "Stock correction"  
}

Every manual change creates an:

InventoryMovement  
---

# **2C.16 Promotion API**

GET   /api/v1/promotions  
POST  /api/v1/promotions  
PATCH /api/v1/promotions/:id

Coupon:

GET   /api/v1/coupons  
POST  /api/v1/coupons  
PATCH /api/v1/coupons/:id

Customer coupon validation:

POST /api/v1/coupons/validate

But validation at cart level is only preliminary.

**Checkout validates again.**

---

# **2C.17 Wishlist API**

GET    /api/v1/wishlist  
POST   /api/v1/wishlist/items  
DELETE /api/v1/wishlist/items/:productId  
---

# **2C.18 Review API**

Customer:

POST /api/v1/products/:productId/reviews  
GET  /api/v1/products/:productId/reviews

Admin:

PATCH /api/v1/reviews/:id  
DELETE /api/v1/reviews/:id

Potential statuses:

PENDING  
APPROVED  
REJECTED  
---

# **2C.19 Customer API**

GET /api/v1/customer/profile  
PATCH /api/v1/customer/profile

GET /api/v1/customer/addresses  
POST /api/v1/customer/addresses  
PATCH /api/v1/customer/addresses/:id  
DELETE /api/v1/customer/addresses/:id  
---

# **2C.20 Admin APIs**

Admin dashboard should have separate endpoints where privileged aggregation is required.

Example:

GET /api/v1/admin/dashboard

Possible response:

Today's revenue  
Orders  
Customers  
Low-stock products  
Pending orders  
Recent orders  
Sales by market

Don't make the frontend perform 20 unrelated requests for one dashboard if a server-side aggregation endpoint can efficiently provide the required data.

---

# **2C.21 Audit API**

Usually admin-only:

GET /api/v1/admin/audit-logs

Filters:

user  
action  
entityType  
entityId  
dateFrom  
dateTo  
---

# **2C.22 Standard API Response**

Success:

{  
  "success": true,  
  "data": {},  
  "meta": {}  
}

List:

{  
  "success": true,  
  "data": \[\],  
  "meta": {  
    "page": 1,  
    "limit": 20,  
    "total": 125,  
    "totalPages": 7  
  }  
}

Error:

{  
  "success": false,  
  "error": {  
    "code": "PRODUCT\_NOT\_FOUND",  
    "message": "Product was not found."  
  }  
}

Do not expose:

stack traces  
SQL errors  
Prisma internals  
secret values

in production responses.

---

# **2C.23 HTTP Status Strategy**

Use HTTP semantics consistently.

200 OK  
201 Created  
204 No Content

400 Bad Request  
401 Unauthorized  
403 Forbidden  
404 Not Found  
409 Conflict  
422 Validation Error  
429 Too Many Requests

500 Internal Server Error

Examples:

### **Unauthenticated**

401

### **Authenticated but no permission**

403

### **Duplicate coupon**

409

### **Invalid request schema**

422  
---

# **2C.24 Validation**

Use a schema validation layer such as Zod.

Flow:

Request  
 ↓  
Zod validation  
 ↓  
Authentication  
 ↓  
Authorization  
 ↓  
Business validation  
 ↓  
Database

Validate:

type  
format  
length  
range  
enum  
required fields  
IDs  
pagination  
filters

Never trust:

quantity  
price  
discount  
tax  
total  
role  
userId  
market access

from the browser.

---

# **2C.25 Authorization**

Authorization should use permissions.

Bad:

if (user.isAdmin) {  
   ...  
}

Better:

requirePermission(user, "product.update");

Example:

Super Admin  
 ├── product.\*  
 ├── order.\*  
 ├── inventory.\*  
 └── user.\*

Catalog Manager  
 ├── product.view  
 ├── product.create  
 └── product.update

Customer  
 ├── order.create  
 ├── order.viewOwn  
 └── review.create

Also distinguish:

view all orders

from:

view own orders  
---

# **2C.26 API Security**

Required baseline:

HTTPS  
Secure cookies  
HttpOnly cookies  
SameSite policy  
CSRF protection strategy  
Rate limiting  
Request validation  
Authorization  
Password hashing  
Session expiration  
Webhook signature validation  
Upload validation  
Security headers  
Secret isolation  
Audit logging

Never expose secrets to client-side code.

---

# **2C.27 Pagination**

Default:

page \= 1  
limit \= 20

Maximum:

limit \= 100

Never allow:

?limit=1000000

For high-volume datasets later, cursor pagination can replace offset pagination.

---

# **2C.28 Search**

### **MVP**

PostgreSQL search:

products  
categories  
brands

Search fields:

name  
description  
SKU  
brand  
category

Later, if catalog size/search complexity justifies it:

Dedicated search engine

Do not introduce Elasticsearch/OpenSearch merely because the application is called a SaaS/e-commerce platform.

---

# **2C.29 Caching**

Do not cache everything.

Good candidates:

Categories  
Product catalog  
Market configuration  
Shipping methods  
CMS content  
Frequently accessed settings

Be careful caching:

Inventory  
Checkout totals  
Payment state  
Order state

Redis can be introduced when there is an actual caching/rate-limiting/session/queue requirement.

---

# **2C.30 Background Jobs**

Suitable for asynchronous work:

Email  
SMS  
Notifications  
Webhook retries  
Inventory synchronization  
Report generation  
Image processing  
Abandoned-cart processing

Conceptually:

API  
 ↓  
Create job  
 ↓  
Queue  
 ↓  
Worker  
 ↓  
Process  
 ↓  
Retry if necessary

Do not block a customer request for non-critical operations.

---

# **2C.31 API Idempotency**

Use idempotency for:

POST /checkout  
POST /payments  
POST /refund  
payment webhooks

Example:

Client sends request  
↓  
Server stores idempotency key  
↓  
Operation executes  
↓  
Response stored  
↓  
Client retries same request  
↓  
Server returns previous result

This protects against:

Double order  
Double payment  
Double refund  
---

# **2C.32 API Versioning**

Start with:

/api/v1

Future breaking changes:

/api/v2

Do not unnecessarily create versions for every small change.

---

# **2C.33 Domain Ownership**

This is extremely important for keeping the application maintainable.

Catalog  
  owns products/variants/categories

Pricing  
  owns prices

Inventory  
  owns stock/movements

Orders  
  owns orders/order items

Payments  
  owns payment lifecycle

Shipping  
  owns shipment lifecycle

Customers  
  owns customer profile/address

Promotions  
  owns promotions/coupons

Identity  
  owns authentication/authorization

For example:

**Order service should not directly modify arbitrary inventory rows.**

It should call the Inventory domain/service responsible for stock operations.

---

# **2C.34 Critical Business Rules**

### **Product**

Product cannot be purchased if inactive.

### **Variant**

SKU must be unique.

### **Pricing**

Price is determined server-side.

### **Inventory**

Available \= quantity \- reservedQuantity

### **Checkout**

Inventory must be revalidated during checkout.

### **Order**

Historical product/price/address information is preserved.

### **Payment**

Frontend redirect ≠ payment confirmation.

### **Webhook**

Webhook must be verified \+ idempotent.

### **Authorization**

Role ≠ permission.  
---

# **2B \+ 2C Final Architecture**

The complete flow is now:

                   ┌─────────────────────┐  
                    │      Next.js UI     │  
                    └──────────┬──────────┘  
                               │  
                               ▼  
                    ┌─────────────────────┐  
                    │   API / Route Layer │  
                    └──────────┬──────────┘  
                               │  
                         Validation  
                               │  
                         Authentication  
                               │  
                         Authorization  
                               │  
                               ▼  
                    ┌─────────────────────┐  
                    │ Application Services│  
                    └──────────┬──────────┘  
                               │  
                               ▼  
                    ┌─────────────────────┐  
                    │    Domain Services  │  
                    └──────────┬──────────┘  
                               │  
                 ┌─────────────┼─────────────┐  
                 ▼             ▼             ▼  
             Catalog        Orders       Inventory  
                 │             │             │  
                 └─────────────┼─────────────┘  
                               ▼  
                    ┌─────────────────────┐  
                    │ Repository / Prisma │  
                    └──────────┬──────────┘  
                               ▼  
                    ┌─────────────────────┐  
                    │     PostgreSQL      │  
                    └─────────────────────┘

Supporting infrastructure:

            ┌──────────────┐  
             │    Redis     │ ← cache/rate-limit/queue  
             └──────────────┘

             ┌──────────────┐  
             │ Object Store │ ← product/media files  
             └──────────────┘

             ┌──────────────┐  
             │ Queue/Worker │ ← async jobs  
             └──────────────┘

             ┌──────────────┐  
             │ Payment APIs │  
             └──────────────┘

             ┌──────────────┐  
             │Shipping APIs │  
             └──────────────┘

## **Phase 2B Status**

**Complete:** database model, relationships, constraints, enums, indexes, transactions, historical snapshots, deletion strategy, Prisma direction.

## **Phase 2C Status**

**Complete:** API domains, endpoints, request/response conventions, validation, authorization, payment/webhooks, idempotency, security, pagination, caching, background jobs, and domain ownership.

## **2D — Project & Folder Architecture**

### **2D.1 Technology Stack**

### **Frontend**

* Next.js  
* React  
* TypeScript  
* Tailwind CSS  
* shadcn/ui  
* React Hook Form  
* Zod  
* TanStack Query  
* Zustand only where client-side global state is genuinely required

### **Backend**

* Next.js server-side architecture  
* Route Handlers for HTTP APIs  
* Service/domain layer  
* Prisma ORM  
* PostgreSQL

### **Infrastructure**

* Redis — caching, rate limiting, queues where required  
* Object storage — product/media assets  
* Background workers — asynchronous processing  
* Payment provider integrations  
* Shipping provider integrations

### **Development**

* ESLint  
* Prettier  
* TypeScript strict mode  
* Vitest/Jest for unit tests  
* Playwright for E2E  
* Git \+ GitHub  
* CI/CD

---

# **2D.2 Recommended Repository Structure**

project-root/  
│  
├── app/  
│   ├── (storefront)/  
│   ├── (auth)/  
│   ├── admin/  
│   ├── account/  
│   ├── checkout/  
│   ├── orders/  
│   ├── products/  
│   │  
│   ├── api/  
│   │   └── v1/  
│   │  
│   ├── layout.tsx  
│   ├── error.tsx  
│   ├── loading.tsx  
│   ├── not-found.tsx  
│   └── globals.css  
│  
├── components/  
│   ├── ui/  
│   ├── layout/  
│   ├── forms/  
│   ├── feedback/  
│   └── shared/  
│  
├── features/  
│   ├── auth/  
│   ├── products/  
│   ├── categories/  
│   ├── cart/  
│   ├── checkout/  
│   ├── orders/  
│   ├── payments/  
│   ├── shipping/  
│   ├── inventory/  
│   ├── promotions/  
│   ├── wishlist/  
│   ├── reviews/  
│   ├── customers/  
│   └── admin/  
│  
├── server/  
│   ├── services/  
│   ├── repositories/  
│   ├── domain/  
│   ├── policies/  
│   ├── validators/  
│   ├── mappers/  
│   └── integrations/  
│  
├── lib/  
│   ├── auth/  
│   ├── db/  
│   ├── cache/  
│   ├── http/  
│   ├── errors/  
│   ├── logger/  
│   ├── security/  
│   ├── utils/  
│   └── constants/  
│  
├── hooks/  
│  
├── stores/  
│  
├── types/  
│  
├── config/  
│  
├── prisma/  
│   ├── schema.prisma  
│   ├── migrations/  
│   └── seed.ts  
│  
├── jobs/  
│  
├── workers/  
│  
├── emails/  
│  
├── public/  
│  
├── tests/  
│   ├── unit/  
│   ├── integration/  
│   └── e2e/  
│  
├── scripts/  
│  
├── docs/  
│  
├── .env.example  
├── next.config.ts  
├── tsconfig.json  
├── eslint.config.js  
├── prettier.config.js  
├── package.json  
└── README.md

---

# **2D.3 Architectural Rule**

The most important dependency rule is:

UI  
 ↓  
Feature  
 ↓  
API  
 ↓  
Service  
 ↓  
Repository  
 ↓  
Prisma  
 ↓  
PostgreSQL

Never:

Component  
 ↓  
Prisma

and avoid:

Component  
 ↓  
Database logic

Frontend components should not know how the database works.

---

# **2D.4 App Router Organization**

Public storefront:

app/  
└── (storefront)/  
    ├── page.tsx  
    ├── products/  
    ├── categories/  
    ├── cart/  
    └── ...

Authentication:

app/  
└── (auth)/  
    ├── login/  
    ├── register/  
    ├── forgot-password/  
    └── reset-password/

Customer account:

app/  
└── account/  
    ├── profile/  
    ├── addresses/  
    ├── orders/  
    ├── wishlist/  
    └── settings/

Administration:

app/  
└── admin/  
    ├── dashboard/  
    ├── products/  
    ├── categories/  
    ├── inventory/  
    ├── orders/  
    ├── customers/  
    ├── promotions/  
    ├── markets/  
    ├── shipping/  
    ├── reviews/  
    ├── users/  
    └── settings/

---

# **2D.5 Feature Structure**

Each major feature can have:

features/products/  
│  
├── components/  
├── hooks/  
├── queries/  
├── mutations/  
├── schemas/  
├── types/  
└── utils/

Example:

features/products/  
├── components/  
│   ├── ProductCard.tsx  
│   ├── ProductGrid.tsx  
│   ├── ProductFilters.tsx  
│   └── ProductForm.tsx  
│  
├── queries/  
│   ├── useProducts.ts  
│   └── useProduct.ts  
│  
├── mutations/  
│   ├── useCreateProduct.ts  
│   └── useUpdateProduct.ts  
│  
├── schemas/  
│   └── product.schema.ts  
│  
└── types/  
    └── product.types.ts

This keeps feature code together.

---

# **2D.6 Server Structure**

server/  
│  
├── services/  
│   ├── product.service.ts  
│   ├── order.service.ts  
│   ├── checkout.service.ts  
│   ├── payment.service.ts  
│   ├── inventory.service.ts  
│   └── promotion.service.ts  
│  
├── repositories/  
│   ├── product.repository.ts  
│   ├── order.repository.ts  
│   ├── inventory.repository.ts  
│   └── user.repository.ts  
│  
├── domain/  
│   ├── orders/  
│   ├── payments/  
│   ├── inventory/  
│   └── pricing/  
│  
├── policies/  
│   ├── product.policy.ts  
│   ├── order.policy.ts  
│   └── inventory.policy.ts  
│  
├── validators/  
│  
├── mappers/  
│  
└── integrations/  
    ├── payments/  
    ├── shipping/  
    └── email/

---

# **2D.7 Repository Responsibility**

Repository \= database access.

Example:

ProductRepository  
├── findById()  
├── findBySlug()  
├── findMany()  
├── create()  
├── update()  
└── archive()

It should not decide:

"Can this user purchase this product?"

That belongs to the service/domain layer.

---

# **2D.8 Service Responsibility**

Service \= business operation.

Example:

CheckoutService  
├── validateCart()  
├── calculateTotals()  
├── validateInventory()  
├── reserveInventory()  
├── createOrder()  
└── createPayment()

Services coordinate business operations.

---

# **2D.9 Domain Responsibility**

Domain logic contains rules that must remain correct regardless of the UI.

Example:

InventoryDomain  
├── calculateAvailableStock()  
├── reserve()  
├── release()  
├── consume()  
└── adjust()

---

# **2E — Database Implementation**

## **2E.1 Prisma**

Prisma schema should be the canonical database model.

prisma/  
├── schema.prisma  
├── migrations/  
└── seed.ts

Production migrations must be committed to Git.

Never manually change production schema without a migration.

---

# **2E.2 Prisma Client**

Create a single reusable Prisma client instance.

Conceptually:

lib/db/prisma.ts

Development must avoid creating a new database connection on every hot reload.

---

# **2E.3 Database Migration Workflow**

Modify Prisma schema  
        ↓  
Create migration  
        ↓  
Run locally  
        ↓  
Run tests  
        ↓  
Commit migration  
        ↓  
CI validation  
        ↓  
Production migration

Production:

prisma migrate deploy

Development:

prisma migrate dev

---

# **2E.4 Seed Data**

Seed:

Admin role  
System permissions  
Default admin  
Sample categories  
Sample products  
Sample markets  
Development configuration

Never seed production with fake customer/payment data.

---

# **2E.5 Database Indexing**

Indexes should exist for:

User.email  
Product.slug  
ProductVariant.sku  
Order.orderNumber  
Order.userId  
Order.status  
Order.createdAt  
Payment.orderId  
Inventory.variantId  
Coupon.code  
AuditLog.entityId

Composite indexes should follow actual query patterns.

Do not create indexes blindly.

---

# **2E.6 Concurrency**

Critical operations require transactions.

Especially:

Checkout  
Inventory reservation  
Payment state updates  
Refunds  
Coupon usage  
Inventory transfers

Use database-level constraints plus application-level checks.

---

# **2F — Authentication & Authorization**

## **2F.1 Authentication**

Authentication answers:

> Who are you?

Authorization answers:

> What are you allowed to do?

Keep these concepts separate.

---

# **2F.2 Authentication Flow**

Register  
 ↓  
Hash password  
 ↓  
Create user  
 ↓  
Create session  
 ↓  
Secure cookie

Login:

Email/password  
 ↓  
Find user  
 ↓  
Compare password hash  
 ↓  
Verify account state  
 ↓  
Create session  
 ↓  
Set secure cookie

---

# **2F.3 Password Security**

Use:

Argon2id

or another strong password hashing algorithm supported by the selected authentication implementation.

Never:

MD5  
SHA1  
Plain text

---

# **2F.4 Authorization**

Permission examples:

product.view  
product.create  
product.update  
product.archive

order.view  
order.viewOwn  
order.update  
order.cancel

inventory.view  
inventory.adjust

user.view  
user.create  
user.update  
user.delete

report.view  
settings.manage

---

# **2F.5 RBAC**

Role  
 ↓  
Permissions  
 ↓  
User

Example:

Super Admin  
Admin  
Catalog Manager  
Order Manager  
Inventory Manager  
Customer Support  
Customer

But permissions remain the actual authorization mechanism.

---

# **2F.6 Ownership Authorization**

A customer should not be able to request:

GET /orders/another-users-order

Even if they are authenticated.

Service must verify:

order.userId \=== currentUser.id

unless the user has privileged permission.

---

# **2G — API Infrastructure**

## **2G.1 Route Handler**

Route handler responsibilities:

Receive request  
 ↓  
Parse input  
 ↓  
Authenticate  
 ↓  
Validate  
 ↓  
Authorize  
 ↓  
Call service  
 ↓  
Map response

Do not put large business logic inside route handlers.

---

# **2G.2 Service Example**

POST /checkout  
      ↓  
checkout.route.ts  
      ↓  
checkout.schema.ts  
      ↓  
checkout.service.ts  
      ↓  
pricing service  
inventory service  
order service  
payment service  
      ↓  
Prisma transaction

---

# **2G.3 DTOs**

Never automatically expose entire Prisma models.

Create response DTOs.

Example:

ProductResponse  
├── id  
├── name  
├── slug  
├── images  
├── price  
├── availability  
└── variants

Instead of returning internal database fields such as:

internal flags  
audit information  
internal IDs  
private metadata

---

# **2G.4 Error Architecture**

Create application errors:

AppError  
├── AuthenticationError  
├── AuthorizationError  
├── ValidationError  
├── NotFoundError  
├── ConflictError  
├── PaymentError  
├── InventoryError  
└── BusinessRuleError

Each error maps to the appropriate HTTP response.

---

# **2G.5 Logging**

Use structured logging.

Example:

{  
  "requestId": "...",  
  "userId": "...",  
  "action": "checkout",  
  "orderId": "...",  
  "duration": 320  
}

Never log:

passwords  
card data  
CVV  
authentication secrets  
session tokens

---

# **2H — State & Data Management**

## **2H.1 Server State**

Use TanStack Query for:

Products  
Orders  
Inventory  
Customer data  
Admin data  
Reviews  
Promotions

Server state should not be duplicated unnecessarily in Zustand.

---

# **2H.2 Client State**

Use local React state for:

Modal open/close  
Form state  
Dropdown state  
Temporary UI state

Use Zustand only for genuinely global client state such as:

Cart UI state  
Theme/preferences  
Certain persistent client preferences

---

# **2H.3 URL State**

Use URL query parameters for:

Search  
Filters  
Sorting  
Pagination  
Category

Example:

/products?category=resin\&sort=price-asc\&page=2

This improves:

* shareability  
* browser navigation  
* SEO  
* persistence

---

# **2H.4 Server vs Client Components**

Prefer Server Components by default.

Use Client Components when requiring:

useState  
useEffect  
event handlers  
browser APIs  
interactive UI

Do not mark entire pages `"use client"` unnecessarily.

---

# **2I — Core Commerce Flows**

## **2I.1 Product Browsing**

Visitor  
 ↓  
Select market  
 ↓  
Browse category  
 ↓  
Search/filter  
 ↓  
Product detail  
 ↓  
Select variant  
 ↓  
Add to cart

---

# **2I.2 Cart**

Add product  
 ↓  
Server validates availability  
 ↓  
Cart updated  
 ↓  
UI refreshes

Cart totals should always be recalculated server-side.

---

# **2I.3 Checkout**

Cart  
 ↓  
Address  
 ↓  
Shipping method  
 ↓  
Coupon  
 ↓  
Payment  
 ↓  
Final server calculation  
 ↓  
Order creation  
 ↓  
Payment processing  
 ↓  
Confirmation

---

# **2I.4 Payment**

Order created  
 ↓  
Payment initiated  
 ↓  
Provider  
 ↓  
Webhook  
 ↓  
Payment verified  
 ↓  
Order paymentStatus updated  
 ↓  
Fulfillment begins

---

# **2I.5 Order State Machine**

Recommended conceptual lifecycle:

PENDING  
   ↓  
CONFIRMED  
   ↓  
PROCESSING  
   ↓  
SHIPPED  
   ↓  
DELIVERED  
   ↓  
COMPLETED

Cancellation paths must be explicitly defined.

Example:

PENDING → CANCELLED  
CONFIRMED → CANCELLED

But:

DELIVERED → CANCELLED

should not simply be allowed.

It may instead require:

RETURN / REFUND

---

# **2I.6 Inventory State**

On hand  
 ↓  
Reserved  
 ↓  
Committed  
 ↓  
Consumed

Conceptually:

available \= onHand \- reserved

Do not allow:

available \< 0

unless overselling is an explicitly supported business rule.

---

# **2J — Caching & Performance**

## **2J.1 Cache Candidates**

Good:

Categories  
Brands  
CMS  
Market configuration  
Shipping methods  
Public product data

Bad candidates without careful invalidation:

Inventory  
Payment status  
Checkout totals  
Order status

---

# **2J.2 Cache Invalidation**

When product changes:

Update database  
 ↓  
Invalidate product cache  
 ↓  
Invalidate category/list cache if necessary

Do not allow stale prices to persist.

---

# **2J.3 Performance Rules**

Target:

Fast initial page load  
Minimal client JavaScript  
Optimized images  
Pagination  
Database indexes  
Selective queries  
No N+1 queries  
Lazy loading where appropriate  
Caching where justified

---

# **2J.4 N+1 Prevention**

Bad:

Get 100 products  
 ↓  
Query variants for each product

Potentially:

101 queries

Prefer:

1–few optimized queries

using Prisma relations/select/include appropriately.

---

# **2K — Security Architecture**

## **2K.1 Security Checklist**

HTTPS  
Secure cookies  
HttpOnly cookies  
SameSite  
CSRF strategy  
CORS policy  
Rate limiting  
Input validation  
Output sanitization  
Authorization  
Password hashing  
Session expiration  
Webhook verification  
File validation  
Security headers  
Secret management  
Audit logging

---

# **2K.2 Rate Limiting**

High-risk endpoints:

Login  
Register  
Forgot password  
Password reset  
Coupon validation  
Checkout  
Payment  
Review creation  
Public search

Use Redis or an equivalent distributed mechanism when scaling beyond a single process.

---

# **2K.3 File Upload Security**

For product images:

Validate MIME type  
Validate file size  
Validate extension  
Generate safe filename  
Store outside application server where appropriate  
Process/optimize image  
Never trust original filename

Do not allow executable files through image upload endpoints.

---

# **2K.4 Secrets**

Environment variables:

DATABASE\_URL  
AUTH\_SECRET  
REDIS\_URL  
PAYMENT\_SECRET  
PAYMENT\_WEBHOOK\_SECRET  
STORAGE\_ACCESS\_KEY  
STORAGE\_SECRET\_KEY  
EMAIL\_API\_KEY

Never commit `.env`.

Provide:

.env.example

with placeholder values only.

---

# **2L — Testing Architecture**

Testing should happen at four levels.

## **2L.1 Unit Tests**

Test isolated logic:

calculateTax()  
calculateDiscount()  
calculateOrderTotal()  
calculateAvailableInventory()  
validateCoupon()

---

# **2L.2 Integration Tests**

Test:

Service \+ database  
Checkout  
Inventory reservation  
Order creation  
Payment state transitions

---

# **2L.3 API Tests**

Test:

Authentication  
Authorization  
Validation  
HTTP status codes  
Response structure  
Error handling

---

# **2L.4 E2E Tests**

Critical user journeys:

Register  
Login  
Browse product  
Add to cart  
Checkout  
Payment  
View order  
Admin login  
Create product  
Update inventory  
Process order

---

# **2L.5 Critical Test Scenario**

Checkout should test:

Valid checkout  
Invalid address  
Out-of-stock item  
Insufficient stock  
Expired coupon  
Invalid coupon  
Price changed  
Duplicate request  
Payment failure  
Payment retry  
Webhook retry  
Concurrent checkout

---

# **2M — Observability & Monitoring**

## **2M.1 Application Monitoring**

Monitor:

Request latency  
Error rate  
API failures  
Database errors  
Payment failures  
Checkout failures  
Background job failures

---

# **2M.2 Business Monitoring**

Track:

Orders  
Revenue  
Conversion  
Cart abandonment  
Payment failures  
Refunds  
Low inventory  
Top products

---

# **2M.3 Request Correlation**

Every request should ideally have:

requestId

Example:

Frontend  
 ↓  
requestId  
 ↓  
API  
 ↓  
Service  
 ↓  
Database/logs

This makes production debugging significantly easier.

---

# **2N — Background Jobs & Events**

## **2N.1 Jobs**

Use workers for:

Order confirmation email  
Shipping notification  
Password reset email  
Low-stock notification  
Abandoned cart processing  
Image processing  
Webhook retry  
Report generation

---

# **2N.2 Event Model**

Conceptually:

OrderPlaced  
OrderPaid  
OrderShipped  
OrderDelivered  
OrderCancelled  
PaymentFailed  
InventoryLow  
RefundCreated

Then subscribers can react.

Example:

OrderPaid  
 ├── Send confirmation email  
 ├── Update analytics  
 └── Start fulfillment

This reduces coupling.

---

# **2N.3 Retry Strategy**

Background jobs should support:

Retry  
Exponential backoff  
Maximum attempts  
Dead-letter handling  
Logging  
Idempotency

Never endlessly retry a permanently invalid job.

---

# **2O — External Integrations**

## **2O.1 Payment Provider Adapter**

Application:

PaymentService

Integration:

PaymentProviderAdapter

Implementation:

providers/  
├── provider-a.ts  
├── provider-b.ts  
└── mock-provider.ts

The domain should not know provider-specific API details.

---

# **2O.2 Shipping Adapter**

Same principle:

ShippingService  
       ↓  
ShippingProvider  
       ↓  
Provider implementation

This makes providers replaceable.

---

# **2O.3 Email**

Use an email service abstraction:

EmailService  
├── sendWelcomeEmail()  
├── sendOrderConfirmation()  
├── sendPasswordReset()  
├── sendShippingUpdate()  
└── sendRefundConfirmation()

---

# **2P — Deployment Architecture**

## **2P.1 Production**

Conceptually:

                   Internet  
                       │  
                       ▼  
                CDN / Edge Layer  
                       │  
                       ▼  
                  Next.js App  
                       │  
          ┌────────────┼────────────┐  
          ▼            ▼            ▼  
      PostgreSQL     Redis       Storage  
          │  
          ▼  
      Backups

External:

Payment Provider  
Shipping Provider  
Email Provider

---

# **2P.2 Environments**

Maintain:

Development  
Staging  
Production

Never use production credentials locally.

---

# **2P.3 CI/CD**

Pipeline:

Push  
 ↓  
Install  
 ↓  
Lint  
 ↓  
Typecheck  
 ↓  
Unit tests  
 ↓  
Integration tests  
 ↓  
Build  
 ↓  
E2E where appropriate  
 ↓  
Deploy staging  
 ↓  
Verification  
 ↓  
Production deployment

---

# **2P.4 Database Deployment**

Before production migration:

Backup  
 ↓  
Migration validation  
 ↓  
Deploy migration  
 ↓  
Deploy application  
 ↓  
Health check

For destructive schema changes, use expand/contract migration strategy.

---

# **2P.5 Backup**

PostgreSQL must have:

Automated backups  
Retention policy  
Point-in-time recovery where available  
Recovery testing

A backup that has never been restored/tested should not be considered reliable.

---

# **2Q — Disaster Recovery**

Define:

### **RPO**

Maximum acceptable data loss.

Example:

RPO \= 15 minutes

### **RTO**

Maximum acceptable recovery time.

Example:

RTO \= 1 hour

These are infrastructure/business decisions, but the architecture must support the required targets.

---

# **2R — Admin Architecture**

Admin must be treated as a separate operational surface.

/admin

Major areas:

Dashboard  
Products  
Categories  
Brands  
Inventory  
Orders  
Customers  
Promotions  
Coupons  
Markets  
Shipping  
Reviews  
Users  
Roles  
Permissions  
CMS  
Reports  
Audit Logs  
Settings

Admin APIs must enforce permissions server-side.

Hiding a button is **not authorization**.

---

# **2S — Reporting Architecture**

Reports should use dedicated optimized queries.

Examples:

Sales  
Revenue  
Orders  
Products  
Customers  
Inventory  
Payments  
Refunds  
Markets

Avoid loading thousands of orders into the frontend and calculating reports there.

Instead:

Frontend  
 ↓  
Report API  
 ↓  
Database aggregation  
 ↓  
Aggregated result

---

# **2T — Data Integrity Rules**

These are mandatory architectural invariants.

### **Money**

Never use JavaScript floating-point arithmetic for persisted monetary values.

### **Order history**

Never rely on current product data to reconstruct historical orders.

### **Inventory**

Every stock adjustment must have a movement record.

### **Payment**

Payment status changes must be traceable.

### **Coupons**

Coupon usage must be transactionally controlled.

### **Authorization**

Every protected server operation must verify permissions.

### **Webhooks**

Every webhook must be verified and idempotent.

### **Checkout**

Final totals must be server-calculated.

---

# **2U — Development Standards**

## **Naming**

Files:

ProductCard.tsx  
product.service.ts  
product.repository.ts  
product.schema.ts

Variables:

camelCase

Types:

PascalCase

Constants:

UPPER\_SNAKE\_CASE

Database:

camelCase Prisma fields

---

# **2U.1 TypeScript**

Use strict mode.

Avoid:

any

unless there is a documented reason.

Prefer:

unknown

when the data is genuinely unknown, followed by validation/narrowing.

---

# **2U.2 Environment Validation**

Application startup should validate required environment variables.

Example conceptual schema:

DATABASE\_URL      required  
AUTH\_SECRET       required  
REDIS\_URL         optional/required by environment  
PAYMENT\_SECRET    required in production

Fail fast if critical configuration is missing.

---

# **2U.3 Git Strategy**

Recommended:

main  
develop  
feature/\*  
fix/\*  
hotfix/\*

or a simpler trunk-based strategy if the team prefers.

Commit examples:

feat: add product filtering  
fix: prevent duplicate checkout  
refactor: extract inventory service  
test: add checkout integration tests  
docs: update deployment guide

---

# **2U.4 Pull Request Requirements**

Before merging:

Typecheck passes  
Lint passes  
Tests pass  
Build passes  
No secrets  
Migration reviewed  
API changes documented  
Security implications considered

---

# **2V — Documentation**

Project documentation should include:

README.md  
docs/  
├── architecture.md  
├── database.md  
├── api.md  
├── authentication.md  
├── authorization.md  
├── deployment.md  
├── environment.md  
├── testing.md  
├── integrations.md  
└── troubleshooting.md

---

# **2W — API Documentation**

Document every endpoint with:

Method  
Path  
Authentication  
Permission  
Request  
Query parameters  
Response  
Errors  
Business rules  
Idempotency requirement

Example:

POST /api/v1/checkout

Auth:  
Required

Permission:  
customer.checkout

Idempotency:  
Required

Body:  
shippingAddressId  
shippingMethodId  
paymentMethod  
couponCode?

Success:  
201

Possible errors:  
400  
401  
409  
422  
500

---

# **2X — Architecture Decision Records**

Important architectural decisions should be documented.

Examples:

ADR-001 Next.js application architecture  
ADR-002 PostgreSQL as primary database  
ADR-003 Prisma ORM  
ADR-004 Permission-based authorization  
ADR-005 Server-side checkout calculation  
ADR-006 Payment provider abstraction  
ADR-007 Inventory reservation strategy  
ADR-008 Redis usage  
ADR-009 Background job architecture

This prevents future developers from accidentally reversing important decisions.

---

# **2Y — Production Readiness Checklist**

Before calling Phase 2 implementation-ready:

## **Architecture**

* Next.js architecture defined  
* Feature boundaries defined  
* Server boundaries defined  
* Repository/service separation defined  
* Integration abstraction defined

## **Database**

* PostgreSQL selected  
* Prisma selected  
* Core schema defined  
* Relationships defined  
* Index strategy defined  
* Transaction boundaries defined  
* Historical snapshots defined  
* Migration strategy defined

## **API**

* API versioning  
* Endpoint structure  
* Request validation  
* DTO strategy  
* Error format  
* Pagination  
* Idempotency  
* Authorization

## **Security**

* Authentication  
* RBAC/permissions  
* Ownership checks  
* Password security  
* Secure cookies  
* Rate limiting  
* Webhook verification  
* Secret management  
* Audit logs

## **Commerce**

* Product lifecycle  
* Variant model  
* Market pricing  
* Cart  
* Checkout  
* Orders  
* Inventory  
* Payments  
* Shipping  
* Promotions  
* Refund considerations

## **Performance**

* Database indexing  
* Pagination  
* N+1 prevention  
* Caching strategy  
* Background jobs  
* Image optimization strategy

## **Quality**

* Unit testing strategy  
* Integration testing  
* API testing  
* E2E testing  
* CI/CD  
* Logging  
* Monitoring  
* Backups  
* Disaster recovery considerations

---

# **2Z — Final End-to-End Architecture**

The complete system can now be understood as:

                        ┌──────────────────────┐  
                         │      CUSTOMER UI     │  
                         │      ADMIN UI        │  
                         └──────────┬───────────┘  
                                    │  
                                    ▼  
                         ┌──────────────────────┐  
                         │     Next.js App      │  
                         │ Server \+ Client      │  
                         └──────────┬───────────┘  
                                    │  
                                    ▼  
                         ┌──────────────────────┐  
                         │     API / v1         │  
                         │ Auth / Validation    │  
                         │ Authorization        │  
                         └──────────┬───────────┘  
                                    │  
                                    ▼  
                    ┌────────────────────────────────┐  
                    │       APPLICATION SERVICES     │  
                    │                                │  
                    │ Catalog                        │  
                    │ Pricing                        │  
                    │ Cart                           │  
                    │ Checkout                       │  
                    │ Orders                         │  
                    │ Payments                       │  
                    │ Inventory                      │  
                    │ Shipping                       │  
                    │ Promotions                     │  
                    │ Customers                      │  
                    └───────────────┬────────────────┘  
                                    │  
                    ┌───────────────┼────────────────┐  
                    ▼               ▼                ▼  
              PostgreSQL          Redis          Workers  
                    │                                │  
                    │                                ▼  
                    │                       Email / Jobs /  
                    │                       Notifications  
                    │  
                    ▼  
                Backups

External:  
    ┌─────────────┐  
    │   Payment   │  
    │   Provider  │  
    └─────────────┘

    ┌─────────────┐  
    │  Shipping   │  
    │   Provider  │  
    └─────────────┘

    ┌─────────────┐  
    │    Object   │  
    │   Storage   │  
    └─────────────┘

---

# **PHASE 2 — FINAL STATUS**

Phase 2 is now considered **architecturally complete**.

We have covered:

2A — System Architecture & Core Technical Decisions  
2B — Exact Database / Prisma Specification  
2C — API Architecture & Contracts  
2D — Project & Folder Architecture  
2E — Database Implementation  
2F — Authentication & Authorization  
2G — API Infrastructure  
2H — State & Data Management  
2I — Core Commerce Flows  
2J — Caching & Performance  
2K — Security Architecture  
2L — Testing Architecture  
2M — Observability & Monitoring  
2N — Background Jobs & Events  
2O — External Integrations  
2P — Deployment Architecture  
2Q — Disaster Recovery  
2R — Admin Architecture  
2S — Reporting Architecture  
2T — Data Integrity  
2U — Development Standards  
2V — Documentation  
2W — API Documentation  
2X — Architecture Decision Records  
2Y — Production Readiness  
2Z — Final End-to-End Architecture

## **The most important principle going forward**

The UI/UX should now be designed **against these technical boundaries**, not the other way around.

For example:

UI  
 ↓  
Feature  
 ↓  
API contract  
 ↓  
Service  
 ↓  
Database

Therefore, when we enter Phase 3, we should not merely design attractive screens.

We need to define:

User journey  
↓  
Information architecture  
↓  
Page hierarchy  
↓  
Navigation  
↓  
Wireframes  
↓  
Component system  
↓  
Responsive behavior  
↓  
Interaction states  
↓  
Loading/error/empty states  
↓  
Accessibility  
↓  
Design system  
↓  
Final screen specifications

This gives us a proper **production SaaS/e-commerce UI/UX specification** rather than a collection of disconnected screens.

---

# Phase 6 — Audit-Clarified Requirements & Target Architecture (2026-09-22)

**Purpose of this section:** everything above this line is the original Phase 1–3 PRD, preserved as written. This section does not edit or delete any of it. It exists because a full codebase audit (backend, frontend, and documentation) on 2026-09-22 found that the system as actually built has diverged from this PRD in specific, mostly deliberate ways, and because the business requirements around Pakistan/UAE markets needed to be stated more precisely than the original spec did. Where this section conflicts with the text above, **this section reflects the current authoritative decision** — the original text is kept for historical record, not as the live spec.

Every item below is labeled **CURRENT** (already correctly built), **TARGET** (agreed direction, not yet built), or **FUTURE** (acknowledged need, no committed timeline).

## 6.1 Acknowledged deviation: backend architecture

**Original PRD (Phase 2):** specified a Next.js-only backend using server actions/API routes inside the same application as the frontend.

**CURRENT (as built):** the backend is a separate Express.js + TypeScript REST API (`backend/`), fully decoupled from the Next.js frontend (`frontend/`), communicating only over `/api/v1/*` HTTP. This is documented as intentional in `docs/PROJECT_CONTEXT.md` and `docs/ARCHITECTURE.md`, but those docs never stated it was a *change* from this PRD's original decision — it is stated here explicitly so the deviation isn't lost. No action is proposed; the Express separation is the correct, desired architecture going forward and should not be reverted.

## 6.2 Market model: Pakistan and UAE are separate commercial markets

**CURRENT — already correctly implemented**, contrary to what an earlier read of this PRD's conceptual schema (`MarketProduct`/`MarketPrice`) might suggest. The actual built entities are:

- `Market` (`code`: `"PK"` / `"AE"`, `currencyCode`, `currencyMinorUnits`) — replaces the PRD's implied single market-config concept.
- `ProductMarket` (`productId`, `marketId`, `isAvailable`, `isVisible`) — per-product, per-market availability and storefront visibility. Composite key, no per-market product duplication.
- `VariantPrice` (`variantId`, `marketId`, `currencyCode`, `amount` in minor units, optional `saleAmount`/`saleStartsAt`/`saleEndsAt`) — replaces the PRD's `MarketPrice`. **Confirmed by full-codebase grep: no FX conversion, exchange-rate lookup, or currency-derivation logic exists anywhere in `backend/src`.** Pakistan and UAE prices are independently set by an admin, exactly as required.
- `VariantStock` (`variantId`, `marketId`, `onHand`, `reserved`) — replaces the PRD's `Warehouse`/`Inventory` concept. There is no warehouse/location entity; Market itself is the only stock-partitioning boundary. `available = onHand - reserved`, computed at read time, never persisted.

**Non-negotiable requirement re-confirmed as CURRENT:** "The UAE price MUST NOT automatically be calculated from PKR" — enforced at both the schema level (independent `VariantPrice` rows) and the service level (`pricing.service.ts::setPrice` never reads another market's price).

**TARGET gap — market resolution/detection:** the backend correctly *enforces* market rules on every request (market is a required, server-validated parameter on Cart/Checkout/Catalog reads), but there is no market *detection* or *default-selection* logic anywhere:
- No IP/geolocation-based market detection exists (backend or frontend).
- The frontend hardcodes `DEFAULT_MARKET_CODE = "PK"` (`frontend/src/lib/constants/market.ts`) for every catalog/price/stock call, regardless of visitor origin.
- The PK/UAE market switcher in the storefront header (`UtilityBar.tsx`) is rendered but non-functional — no `onChange` handler, no persisted selection, nothing in the app reads it.
- There is no `MarketContext` (or equivalent) on the frontend; only `AuthContext` and `CartWishlistContext` exist.

**TARGET:** build a real market-selection mechanism — an explicit user choice (persisted, e.g. cookie) that defaults from IP/geolocation on first visit, is sent as the `market` parameter on every relevant API call, survives navigation/refresh/login, and is never trusted as an authorization boundary by itself (the backend must — and already does — independently validate that a requested market is active and that the requested product/price/stock actually exists for it).

## 6.3 Market-specific product visibility

**CURRENT — already correctly implemented and already backend-enforced.** `GET /products` requires the backend to join `ProductMarket` when a `market` query parameter is supplied; a product not visible/available in the requested market is not returned. An unknown or inactive market code returns `404` rather than leaking an empty-vs-missing distinction. Direct-URL access to a product hidden in a market (`GET /products/slug/:slug`) still resolves the product record itself (it is not market-filtered at the single-item read), but **Cart, Checkout, Pricing, and Inventory each independently re-validate market availability at the point of action** (add-to-cart, price lookup, stock lookup, checkout) — so a hidden product cannot actually be purchased even if its detail page is reachable by URL. This "detail page reachable, purchase path blocked" behavior should be confirmed as the intended UX (vs. a full 404 on the detail page too) in the next implementation phase — it is not a security gap (nothing purchasable leaks) but is a product-decision worth confirming explicitly.

## 6.4 Inventory

**CURRENT — already correctly per-market**, never global/pooled, never warehouse-based (see 6.2). Stock reservations (`StockReservation`, keyed by `(stockId, reference)` for idempotency) and movements (`StockMovement`, append-only) are both market-scoped through `VariantStock`. No changes proposed.

## 6.5 RBAC — roles and permissions

**CURRENT — already correctly implemented as DB-driven RBAC** (`Role`/`Permission`/`RolePermission`/`UserRole`), never a hardcoded `role === "admin"` check anywhere in the codebase (grep-confirmed). Authorization state is re-derived from the database on every authenticated request (not cached in the JWT), so deactivating a role takes effect immediately.

**Reconciling role names:** this PRD's earlier shorthand (SUPER_ADMIN, MANAGER, INVENTORY, CUSTOMER) maps onto the **9 actually-seeded roles** (`backend/prisma/seed.ts`), which is the authoritative role set going forward:

| Shorthand in earlier briefs | Actual seeded role key(s) |
|---|---|
| SUPER_ADMIN | `super_admin` (all permissions) |
| — (finer-grained than the shorthand implied) | `admin` (broad, excludes `roles:*`/`audit:read`) |
| MANAGER | `store_manager`, `product_manager` (catalog+pricing), `order_manager` (fulfilment), `marketing_manager`, `customer_support` |
| INVENTORY | `inventory_manager` (`products:read`, `inventory:*`, `orders:read`) |
| CUSTOMER | `customer` (isSystem, **zero granted permissions** — customer authorization is ownership-only, e.g. "this is my own cart/order," never a permission grant) |

**TARGET gap:** there is no RBAC admin API — roles, permissions, and role assignments exist only via the seed script. There is no `POST /admin/users/:id/roles` or equivalent, and **no HTTP surface for the Users module at all** (no `users.routes.ts`), despite `users:*` permissions already being seeded. A fresh production deployment also has no seeded super-admin account (deliberate — bootstrapping requires a real password and is left as a manual step), so there is currently no way to log into a new production instance as an admin without a manual DB/Prisma Studio intervention. Building the Users + role-assignment HTTP surface is a prerequisite for any admin-dashboard user-management screen.

**TARGET gap — frontend RBAC enforcement:** the frontend `/admin/*` and `/account/*` route layouts currently check only "is authenticated," never role or permission. Any logged-in customer can currently navigate to `/admin/dashboard` (though that page itself has no data or admin actions to abuse). This must be fixed before the admin dashboard has real functionality — frontend gating should read `AuthSession.roles`/`permissions` (already returned by `GET /auth/me`) purely as UX (hide/redirect), with the backend remaining the sole enforcement point on every admin endpoint (already true for all implemented admin routes).

## 6.6 Admin dashboard scope

**TARGET**, confirming the business's stated preference against over-building a CMS: admin-manageable surfaces should be Products (incl. variants/images/categories/market availability/per-market price/stock where permitted), Promotions (once built), Market-level availability/pricing, Inventory, Orders, Users/roles, and Audit log viewing. Static content (About/Contact copy, footer structure) may remain code/config-based. **Hero slider and homepage promotional content should be evaluated for admin management** rather than defaulting to hardcoded — currently `heroSlides.ts` and `PromoBanner.tsx` are fully hardcoded with no backend or CMS backing; this is acceptable for now but should not be assumed permanent without a decision.

## 6.7 Homepage data architecture — current classification

| Section | Classification | Notes |
|---|---|---|
| Hero slider | Frontend static (hardcoded array, `heroSlides.ts`) | No Banner/CMS backend exists |
| Categories | Backend-driven | `GET /categories` |
| Best Sellers / "Top Rated" | Backend-driven, but not a real ranking | `GET /products?limit=6&page=1` — there is no real best-seller/rating-based query; it is simply the first page of products. TARGET: build a real ranking query once enough order/review volume exists to make one meaningful. |
| Trust/feature strip | Frontend static (hardcoded, incl. literal "PKR / AED" copy) | Not market-aware |
| Promo banner | Frontend static, decorative | Not backed by any real discount; Promotions domain not started; checkout explicitly rejects coupon codes |
| Category-based product section ("Trending Now") | Backend-driven, but not a real "trending" signal | Currently just page 2 of the same product list. TARGET: replace with the category-selector behavior described below. |
| Testimonials | Backend-driven | `GET /reviews/featured` — real data, but reviews have no submission/moderation endpoint yet, so all current reviews are seed data |
| "Our Story" / brand values | Frontend static (hardcoded) | Acceptable as static content per 6.6 |
| Footer | Frontend static (nav links) | Acceptable as static content |

**TARGET — category-based product section:** replace "Trending Now" with a category selector that, on selection, fetches that category's top products **respecting the active market's visibility, availability, pricing, and stock** — `GET /products?category=<id>&market=<code>&limit=6` already supports this query shape; the gap is entirely frontend (no category-selector UI exists yet) plus the market-context gap in 6.2.

**TARGET — best sellers:** do not fabricate a ranking. The backend does not yet have enough order-volume signal to calculate a real "best seller" or "top rated" list; until it does, the homepage should either keep using a clearly-neutral "Featured" framing or wait until Orders/Reviews volume justifies a real ranking query (e.g. units sold in a trailing window, or average rating with a minimum review count).

## 6.8 Mock-data and production-safety policy

**TARGET, formalizing an existing informal gap:** `backend/prisma/seed.ts` has no environment guard — running it against a production database would insert the demo catalog (12 fake products, PK-only) and three fake reviewer accounts with real-shaped emails and working (dummy-hash) passwords. Before any production deployment: (a) seed execution must be gated so it cannot run against a production `DATABASE_URL`, or the demo data must be clearly separated from any legitimate bootstrap data (e.g. Market/Role/Permission rows, which *should* run in production); (b) if the backend API is unreachable in production, the frontend must show an explicit error/empty/unavailable state — there is currently no hardcoded product/price/order fallback data found anywhere in the frontend code, which is correct and should remain the standing rule as new pages are built.

## 6.9 Summary of CURRENT vs. TARGET vs. FUTURE

- **CURRENT (already correct, no architectural change needed):** per-market pricing (no FX derivation), per-market inventory, per-market product visibility enforcement, DB-driven RBAC with 9 real roles, JWT/cookie auth with rotation and reuse detection, Cart/Checkout/Orders/Payments(COD)/Shipping/Returns/Audit-log core flows, frontend/backend separation.
- **TARGET (agreed direction, not yet built — next implementation phases):** market detection/selection UI and context, frontend role-based route gating, RBAC admin API + Users HTTP module, real best-seller/category-product homepage logic, admin dashboard beyond the empty shell, seed-script production guard.
- **FUTURE (acknowledged, no committed timeline):** Customers/Addresses domain, Promotions/Coupons domain, Notifications domain, CMS domain, Analytics domain, real payment gateway beyond COD, Reviews submission/moderation endpoints, shipment tracking UI, multi-origin CORS (if PK/UAE ever need separate storefront domains — current `app.ts` CORS only accepts one static `FRONTEND_URL`).

