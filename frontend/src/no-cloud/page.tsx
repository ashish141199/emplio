import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Stands in for Emplio Cloud's pages (cloud/frontend/app) in a copy without the private cloud/ folder: not found.
export const metadata: Metadata = {};
export default function NoCloud(): React.ReactNode {
  notFound();
}
