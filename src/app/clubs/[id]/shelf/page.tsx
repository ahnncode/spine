import { Suspense } from "react";
import { ShelfPage } from "./ShelfPage";

export const metadata = { title: "Club shelf", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <ShelfPage />
    </Suspense>
  );
}
