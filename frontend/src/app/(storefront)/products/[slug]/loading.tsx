import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";

export default function ProductDetailLoading() {
  return (
    <Container>
      <Section className="py-6">
        <Skeleton className="h-4 w-64" />
      </Section>

      <Section className="grid grid-cols-1 gap-10 py-0 md:py-0 lg:grid-cols-[1fr_1fr_320px]">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-square w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-16 w-16" />
            <Skeleton className="h-16 w-16" />
            <Skeleton className="h-16 w-16" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>

      <Section className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-32 w-full" />
        </div>
        <ProductGridSkeleton count={4} />
      </Section>
    </Container>
  );
}
