// Emplio Cloud's proxy (the internal console's secret address) when the private cloud/ folder is there; nothing otherwise.
export { proxy } from "@cloud/proxy";

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
