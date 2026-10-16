import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "DJ Scratch terms of service.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
