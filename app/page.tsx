import { redirect } from "next/navigation";

// Entry point — middleware gates access, so send everyone to the dashboard
// (which bounces to /login when there's no session).
export default function Home() {
  redirect("/dashboard");
}
