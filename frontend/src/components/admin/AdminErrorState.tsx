import { ErrorState } from "@/components/ui/ErrorState";

interface AdminErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Distinguishes a real fetch failure from an empty result — an admin data
 * page must never silently render an empty table when its API call failed.
 * onRetry is optional so this also renders safely from a Server Component
 * (no client-only callback required).
 */
export function AdminErrorState({ message = "Couldn't load this data. Please try again.", onRetry }: AdminErrorStateProps) {
  return <ErrorState message={message} onRetry={onRetry} />;
}
