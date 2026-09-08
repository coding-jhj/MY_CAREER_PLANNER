"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "../../lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });

    if (result.error) {
      setError(result.error.message);
      setPending(false);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("가입이 완료되었습니다. 이메일 인증을 마친 뒤 로그인하세요.");
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand"><span className="auth-brand-mark">✦</span><span>MY CAREER PLANNER</span></div>
        <span className="section-kicker">{mode === "login" ? "WELCOME BACK" : "START YOUR SPACE"}</span>
        <h1 id="auth-heading">{mode === "login" ? "내 플래너에 로그인" : "나만의 플래너 만들기"}</h1>
        <p className="auth-description">계획과 실행 기록은 로그인한 내 계정에서만 안전하게 관리됩니다.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="auth-email">이메일</label>
          <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="auth-password">비밀번호</label>
          <input id="auth-password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={pending}>{pending ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}</button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "아직 계정이 없나요? " : "이미 계정이 있나요? "}
          <Link href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "회원가입" : "로그인"}</Link>
        </p>
      </section>
    </main>
  );
}
