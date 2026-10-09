import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;

  return (
    <PagePlaceholder
      eyebrow="Article"
      title={slug}
      description="Blog post content will be implemented in a later phase."
    />
  );
}
