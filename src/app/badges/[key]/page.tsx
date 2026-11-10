import { Suspense } from "react";
import { BadgePage } from "./BadgePage";

export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <BadgePage />
    </Suspense>
  );
}
