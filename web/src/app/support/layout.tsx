import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support | DJ Scratch",
  description: "Get help with DJ Scratch without Discord: FAQs and a contact form.",
  openGraph: {
    title: "Support | DJ Scratch",
    description: "Get help with DJ Scratch without Discord: FAQs and a contact form.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
