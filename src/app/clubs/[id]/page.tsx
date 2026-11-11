import { Suspense } from "react";
import { ClubPage } from "./ClubPage";

export const metadata = { title: "Book club", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <ClubPage />
    </Suspense>
  );
}
