import type { Metadata } from "next";
import Landing from "./HomePage";

// Only the home page claims the site's root as its canonical address.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Page() {
  return <Landing />;
}
