import { redirect } from "next/navigation";

export default function Root() {
  // Always land on login — dashboard pages handle their own auth check client-side
  redirect("/auth/login");
}
