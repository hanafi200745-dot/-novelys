import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Novélys · Cours particuliers",
  description: "Cours particuliers de mathématiques et physique-chimie. Réservez vos séances et retrouvez le suivi de votre enfant.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
