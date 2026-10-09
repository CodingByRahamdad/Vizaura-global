import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CategoryTile } from "@/components/catalog/CategoryTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCategories } from "@/lib/api/catalog";

export default async function CategoriesPage() {
  const categories = await getCategories().catch(() => []);

  return (
    <Container>
      <Section>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
          Browse
        </p>
        <h1 className="mb-6 font-serif text-3xl font-semibold text-text md:text-4xl">
          All Categories
        </h1>
        {categories.length === 0 ? (
          <EmptyState
            title="No categories available"
            description="Check back soon, or browse all products instead."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {categories.map((category) => (
              <CategoryTile key={category.id} category={category} />
            ))}
          </div>
        )}
      </Section>
    </Container>
  );
}
