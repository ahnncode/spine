import { Suspense } from "react";
import { RevealPage } from "./RevealPage";

export const metadata = { title: "The reveal", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <RevealPage />
    </Suspense>
  );
}
