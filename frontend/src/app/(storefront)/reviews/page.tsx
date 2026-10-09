import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Badge } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ShopPagination } from "@/components/catalog/ShopPagination";
import { getAllReviews } from "@/lib/api/reviews";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "All Reviews — VIZAURA GLOBAL",
  description: "Real reviews from real customers, across every VIZAURA GLOBAL product.",
};

const PAGE_SIZE = 12;

export default async function AllReviewsPage({ searchParams }: PageProps<"/reviews">) {
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  let result;
  try {
    result = await getAllReviews({ page, limit: PAGE_SIZE });
  } catch {
    return (
      <Container>
        <Section>
          <ErrorState message="Couldn't load reviews right now." />
        </Section>
      </Container>
    );
  }

  const { items, pagination } = result;

  return (
    <Container>
      <div className="py-4">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "All Reviews" }]} />
      </div>

      <Section className="pt-0">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
            What Our Customers Say
          </p>
          <h1 className="font-serif text-2xl font-semibold text-text">All Reviews</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {pagination.total} review{pagination.total === 1 ? "" : "s"} across every product.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState title="No reviews yet" description="Check back soon." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((review) => (
              <div key={review.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <Link
                  href={`/products/${review.product.slug}`}
                  className="flex items-center gap-3 rounded-md -m-1 p-1 hover:bg-bg"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                    <SafeImage src={review.product.imageUrl} alt={review.product.imageAlt ?? review.product.name} />
                  </div>
                  <p className="truncate text-sm font-medium text-primary-dark">{review.product.name}</p>
                </Link>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5" aria-hidden>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={cn("h-3.5 w-3.5", index < review.rating ? "fill-warning text-warning" : "text-border")}
                      />
                    ))}
                  </div>
                  {review.title ? <span className="text-sm font-medium text-text">{review.title}</span> : null}
                  {review.isVerifiedPurchase ? <Badge variant="success">Verified Purchase</Badge> : null}
                </div>

                <p className="text-sm text-text-secondary">{review.body}</p>

                <p className="mt-auto text-xs text-text-secondary">
                  {review.authorName}
                  {review.authorLocation ? `, ${review.authorLocation}` : ""} ·{" "}
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <ShopPagination pagination={pagination} />
      </Section>
    </Container>
  );
}
