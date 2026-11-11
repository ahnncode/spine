import { Suspense } from "react";
import { PacePage } from "./PacePage";

export const metadata = { title: "Club pace", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <PacePage />
    </Suspense>
  );
}
