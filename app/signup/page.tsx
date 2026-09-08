import { redirect } from "next/navigation";

import { AuthForm } from "../../components/auth/AuthForm";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export default async function SignupPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <AuthForm mode="signup" />;
}
