"use client";

import { useEffect } from "react";
import { rememberSignupSource } from "@/lib/data";

/**
 * Remembers the utm_source / utm_campaign on the link someone first arrived by
 * (an ad, a post), so it can be saved on their profile when they sign up.
 */
export function SignupSource() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const source = q.get("utm_source");
    if (source) rememberSignupSource(source, q.get("utm_campaign"));
  }, []);
  return null;
}
