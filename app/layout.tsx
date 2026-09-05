import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wilson Next",
  description: "Experimental synthetic-only Form FDA 3500 workflow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
