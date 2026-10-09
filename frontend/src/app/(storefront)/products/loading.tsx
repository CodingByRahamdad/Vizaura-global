import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductGridSkeleton } from "@/components/catalog/ProductGridSkeleton";

export default function ProductsLoading() {
  return (
    <Container>
      <Section>
        <Skeleton className="mb-2 h-4 w-20" />
        <Skeleton className="mb-6 h-9 w-64" />
        <ProductGridSkeleton count={12} />
      </Section>
    </Container>
  );
}
