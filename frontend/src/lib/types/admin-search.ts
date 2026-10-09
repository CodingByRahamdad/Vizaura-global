/** Mirrors backend/src/modules/search/search.service.ts's GlobalSearchResult verbatim. */

export interface AdminSearchResults {
  query: string;
  results: {
    products?: { id: string; name: string; slug: string }[];
    orders?: { id: string; orderNumber: string; status: string; customerEmail: string | null }[];
    customers?: { id: string; name: string; email: string }[];
    users?: { id: string; name: string; email: string }[];
    categories?: { id: string; name: string; slug: string }[];
  };
}
