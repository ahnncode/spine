"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: supabaseConfigured });

  useEffect(() => {
    if (!supabaseConfigured) return;
    const client = supabase();
    client.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = client.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function SetupNotice() {
  return (
    <div className="app">
      <main className="screen screen--flow">
        <span className="wordmark">spine</span>
        <h1 className="h1" style={{ marginTop: 32 }}>Almost there.</h1>
        <p className="lede">
          Spine needs a Supabase project to store accounts and shelves. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code> (or your host&rsquo;s environment
          settings), run the SQL in <code>supabase/migrations</code>, then reload.
        </p>
      </main>
    </div>
  );
}

/** Renders children only for signed-in readers; sends everyone else to sign in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (supabaseConfigured && !loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (!supabaseConfigured) return <SetupNotice />;
  if (loading || !session) {
    return (
      <div className="app">
        <main className="screen" aria-busy="true">
          <span className="visually-hidden">Loading</span>
        </main>
      </div>
    );
  }
  return <>{children}</>;
}
