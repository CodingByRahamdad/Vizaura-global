import { ProductsService } from "../catalog/products.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { UsersService } from "../users/users.service.js";
import { CategoriesService } from "../catalog/categories.service.js";
import type { ListAdminOrdersQuery } from "../orders/orders.validators.js";
import type { ListAdminUsersQuery, ListAdminCustomersQuery } from "../users/users.validators.js";

const RESULT_LIMIT = 5;

export interface GlobalSearchResult {
  query: string;
  results: {
    products?: { id: string; name: string; slug: string }[];
    orders?: { id: string; orderNumber: string; status: string; customerEmail: string | null }[];
    customers?: { id: string; name: string; email: string }[];
    users?: { id: string; name: string; email: string }[];
    categories?: { id: string; name: string; slug: string }[];
  };
}

/// Fans out a single query to every domain's own existing search-capable
/// Service (never a repository directly — same cross-domain rule every
/// other module follows). A result group is omitted entirely, not returned
/// empty, when the caller lacks that domain's `*:read` permission, so the
/// admin UI never renders a section it has no right to see.
export class SearchService {
  constructor(
    private readonly productsService: ProductsService = new ProductsService(),
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly usersService: UsersService = new UsersService(),
    private readonly categoriesService: CategoriesService = new CategoriesService(),
  ) {}

  async search(q: string, permissions: Set<string>): Promise<GlobalSearchResult> {
    const results: GlobalSearchResult["results"] = {};

    const tasks: Promise<void>[] = [];

    if (permissions.has("products:read")) {
      tasks.push(
        this.productsService
          .listForAdmin({ search: q, canSeeAllStatuses: true }, { skip: 0, take: RESULT_LIMIT })
          .then(({ products }) => {
            results.products = products.map((product) => ({
              id: product.id,
              name: product.name,
              slug: product.slug,
            }));
          }),
      );
    }

    if (permissions.has("orders:read")) {
      const query = { page: 1, limit: RESULT_LIMIT, search: q } as ListAdminOrdersQuery;
      tasks.push(
        this.ordersService.listAdmin(query, 0, RESULT_LIMIT).then(({ orders }) => {
          results.orders = orders.map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerEmail: order.user?.email ?? order.guestEmail ?? null,
          }));
        }),
      );
    }

    if (permissions.has("customers:read")) {
      const query = { page: 1, limit: RESULT_LIMIT, search: q } as ListAdminCustomersQuery;
      tasks.push(
        this.usersService.listCustomers(query, 0, RESULT_LIMIT).then(({ rows }) => {
          results.customers = rows.map((row) => ({
            id: row.id,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
          }));
        }),
      );
    }

    if (permissions.has("users:read")) {
      const query = { page: 1, limit: RESULT_LIMIT, search: q } as ListAdminUsersQuery;
      tasks.push(
        this.usersService.listAdmin(query, 0, RESULT_LIMIT).then(({ rows }) => {
          results.users = rows.map((row) => ({
            id: row.id,
            name: `${row.firstName} ${row.lastName}`.trim(),
            email: row.email,
          }));
        }),
      );
    }

    if (permissions.has("categories:read")) {
      tasks.push(
        this.categoriesService
          .list({ includeInactive: true, search: q }, { skip: 0, take: RESULT_LIMIT })
          .then(({ categories }) => {
            results.categories = categories.map((category) => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
            }));
          }),
      );
    }

    await Promise.all(tasks);
    return { query: q, results };
  }
}
