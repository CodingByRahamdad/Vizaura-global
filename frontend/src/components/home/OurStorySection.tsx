import { Globe2, Leaf, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";

const STORY_IMAGE_URL =
  "/about-us/home.webp";

const VALUE_COLUMNS = [
  { icon: Leaf, title: "Natural & Pure", subtitle: "No harmful chemicals" },
  { icon: Globe2, title: "Sustainably Sourced", subtitle: "For a healthier planet" },
  { icon: ShieldCheck, title: "Trusted Worldwide", subtitle: "Quality you can count on" },
];

export function OurStorySection() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className="relative min-h-[260px] overflow-hidden">
        <div className="absolute inset-0">
          <SafeImage src={STORY_IMAGE_URL} alt="" className="h-full w-full" />
          <div className="absolute inset-0 bg-black/50" />
        </div>
        <div className="relative z-10 flex h-full flex-col justify-center gap-3 p-8 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Our Story</p>
          <h2 className="max-w-sm font-serif text-xl font-semibold text-white md:text-2xl">
            Bringing the Purity of Nature to Your Life
          </h2>
          <p className="max-w-sm text-sm text-white/80">
            We believe in the power of natural ingredients. Our mission is to bring you the
            purest and highest quality natural products, sourced from the most pristine regions
            of the world.
          </p>
          <Button href="/about" size="sm" className="mt-1 w-fit">
            Learn More
          </Button>
        </div>
      </div>

      <div className="flex items-center bg-primary-light/30">
        <div className="grid w-full grid-cols-1 gap-6 p-8 sm:grid-cols-3 md:p-10">
          {VALUE_COLUMNS.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center gap-2 text-center">
              <Icon className="h-8 w-8 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-text">{title}</p>
              <p className="text-xs text-text-secondary">{subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
