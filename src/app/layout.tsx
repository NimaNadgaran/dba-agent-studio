import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = { title: "DBA Agent — Database design, thoughtfully orchestrated", description: "Turn a system brief into a considered relational database. Six transparent stages, living documentation, and validated SQL." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
