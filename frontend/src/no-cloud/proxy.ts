import { NextResponse } from "next/server";

// Stands in for Emplio Cloud's proxy (cloud/frontend/proxy.ts) in a copy without the private cloud/ folder.
export const proxy = () => NextResponse.next();
