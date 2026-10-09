import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function ProductNotFound() {
  return (
    <Container>
      <Section>
        <EmptyState
          title="Product not found"
          description="This product may have been removed or the link is incorrect."
          action={<Button href="/products">Browse All Products</Button>}
        />
      </Section>
    </Container>
  );
}
