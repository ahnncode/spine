import { Suspense } from "react";
import { ListPage } from "./ListPage";

export const metadata = { title: "Club list", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <ListPage />
    </Suspense>
  );
}
