"use client";

import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchMyProfile, type Profile } from "@/lib/data";
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

interface ProfileState {
  profile: Profile | null;
  reloadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileState>({ profile: null, reloadProfile: async () => {} });

/** The signed-in reader's profile (available inside RequireAuth). */
export function useProfile() {
  return useContext(ProfileContext);
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

function Loading() {
  return (
    <div className="app">
      <main className="screen" aria-busy="true">
        <span className="visually-hidden">Loading</span>
      </main>
    </div>
  );
}

/**
 * Renders children only for signed-in readers who have picked a username;
 * sends everyone else to sign in or to the welcome step.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const reloadProfile = useCallback(async () => {
    try {
      setProfile(await fetchMyProfile());
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (supabaseConfigured && !loading && !session) {
      // Remember where they were headed (e.g. a friend's profile link) for after sign-in.
      try { sessionStorage.setItem("spine:next", path); } catch {}
      router.replace("/login");
    }
  }, [loading, session, router, path]);

  useEffect(() => {
    if (!session) return;
    let next: string | null = null;
    try {
      next = sessionStorage.getItem("spine:next");
      sessionStorage.removeItem("spine:next");
    } catch {}
    // Same-site paths only ("//evil.com" would leave the site).
    if (next && next !== path && /^\/(?![/\\])/.test(next)) router.replace(next);
  }, [session, path, router]);

  useEffect(() => {
     
    if (session) reloadProfile();
  }, [session, reloadProfile]);

  const needsWelcome = profileLoaded && !profile?.username && path !== "/welcome";
  useEffect(() => {
    if (needsWelcome) router.replace("/welcome");
  }, [needsWelcome, router]);

  if (!supabaseConfigured) return <SetupNotice />;
  if (loading || !session || !profileLoaded || needsWelcome) return <Loading />;
  return <ProfileContext.Provider value={{ profile, reloadProfile }}>{children}</ProfileContext.Provider>;
}
