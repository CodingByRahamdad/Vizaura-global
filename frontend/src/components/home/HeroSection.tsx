import { HeroSlider } from "@/components/home/HeroSlider";
import { getHeroSlides } from "@/components/home/heroSlides";

export function HeroSection() {
  return <HeroSlider slides={getHeroSlides()} />;
}
