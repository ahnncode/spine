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

const NEXT_KEY = "spine:next";
/** Setup and sign-in pages are never worth coming back to. */
const NOT_A_DESTINATION = /^\/(welcome|start|login)?$/;

/** Remember a page someone was headed to (e.g. a friend's profile) before signing in. */
function rememberDestination(path: string) {
  try {
    if (!NOT_A_DESTINATION.test(path)) sessionStorage.setItem(NEXT_KEY, path);
  } catch {}
}

/**
 * Where to go right after signing in: the remembered page if there is one
 * (used once, same-site only), otherwise the feed.
 */
export function takeDestination(): string {
  const next = peekDestination();
  try {
    sessionStorage.removeItem(NEXT_KEY);
  } catch {}
  return next;
}

/** The same, without using it up (for the sign-in email's link). */
export function peekDestination(): string {
  let next: string | null = null;
  try {
    next = sessionStorage.getItem(NEXT_KEY);
  } catch {}
  return next && /^\/(?![/\\])/.test(next) && !NOT_A_DESTINATION.test(next) ? next : "/feed";
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
      rememberDestination(path);
      router.replace("/login");
    }
  }, [loading, session, router, path]);

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
