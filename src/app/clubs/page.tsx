import { Suspense } from "react";
import { ClubsPage } from "./ClubsPage";

export const metadata = { title: "Book clubs" };

export default function Page() {
  return (
    <Suspense>
      <ClubsPage />
    </Suspense>
  );
}
