import { redirect } from "next/navigation";

/**
 * Root entry. The real landing logic (route the user to their locale dashboard
 * or /qmd based on their session) lands with the auth phase; for now everything
 * funnels through /login, which redirects onward after sign-in.
 */
export default function Home() {
  redirect("/login");
}
