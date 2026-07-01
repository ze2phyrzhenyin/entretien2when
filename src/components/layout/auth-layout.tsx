import type { ReactNode } from "react";
import { CenteredCardLayout } from "@/components/layout/centered-card-layout";

export function AuthLayout({ children }: { children: ReactNode }) {
  return <CenteredCardLayout maxWidthClassName="max-w-md">{children}</CenteredCardLayout>;
}
