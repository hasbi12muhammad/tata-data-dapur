import { redirect } from "next/navigation";

// The standalone tutorial page is now part of the Pusat Bantuan page
// (Video Tutorial tab). Keep the old route working for existing links.
export default function TutorialPage() {
  redirect("/help");
}
