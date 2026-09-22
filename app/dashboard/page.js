import { getAuth } from "../../lib/auth.js";
import { redirect } from "next/navigation";
import Dashboard from "../../components/Dashboard.js";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { data } = await getAuth().getSession();
  if (!data?.user) redirect("/login");
  return <Dashboard user={{ name: data.user.name, email: data.user.email }} />;
}
