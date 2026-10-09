import type { ComponentType, ReactNode, SVGProps } from "react";
import { Card } from "@/components/ui/Card";
import { SafeImage } from "@/components/ui/SafeImage";

interface AuthSplitFeature {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
}

interface AuthSplitProps {
  eyebrow: string;
  title: string;
  description: string;
  features?: AuthSplitFeature[];
  children: ReactNode;
}

export function AuthSplit({ eyebrow, title, description, features, children }: AuthSplitProps) {
  return (
    <div className="relative grid min-h-screen grid-cols-1 overflow-hidden md:grid-cols-2">
      <SafeImage
        src="/Login-page/login-page.webp"
        alt=""
        className="absolute inset-0 -z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white/65 via-white/30 to-white/5" />

      <div className="hidden flex-col justify-center gap-4 p-12 md:flex">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-green">
          {eyebrow}
        </p>
        <h1 className="font-serif text-4xl font-semibold text-text">{title}</h1>
        <p className="max-w-sm text-text-secondary">{description}</p>

        {features && features.length > 0 && (
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-text">
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center px-5 py-6 md:px-12 md:py-12">
        <Card className="w-full max-w-md bg-surface/88 shadow-lg backdrop-blur-sm">{children}</Card>
      </div>
    </div>
  );
}
