import { redirect } from "next/navigation";
import { landing } from "@cloud/site";

// Emplio Cloud's landing page; without the private cloud/ folder the app itself is the home page (it asks for a sign-in).
export default function Home() {
  const Landing = landing;
  if (!Landing) redirect("/chat");
  return <Landing />;
}
