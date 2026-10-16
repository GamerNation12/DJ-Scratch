import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DJ Scratch collects, stores, and lets you delete your listening data.",
  alternates: { canonical: "https://dj-scratch.is-a-fullstack.dev/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
