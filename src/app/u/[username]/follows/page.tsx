import { Suspense } from "react";
import { FollowsPage } from "./FollowsPage";

export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <FollowsPage />
    </Suspense>
  );
}
