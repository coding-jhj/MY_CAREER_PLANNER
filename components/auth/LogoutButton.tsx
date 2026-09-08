"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "../../lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
      router.replace("/login");
      router.refresh();
    }
  }

  return <button className="header-logout" type="button" onClick={() => void logout()} disabled={pending}>{pending ? "로그아웃 중…" : "로그아웃"}</button>;
}
