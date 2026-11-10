import { Suspense } from "react";
import { PickPage } from "./PickPage";

export const metadata = { title: "Help pick", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <PickPage />
    </Suspense>
  );
}
