import { Suspense } from "react";
import { ActivityPage } from "./ActivityPage";

export const metadata = { title: "Since you were last here", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <ActivityPage />
    </Suspense>
  );
}
