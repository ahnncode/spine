import { Suspense } from "react";
import { NewClub } from "./NewClub";

export const metadata = { title: "Start a club", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <NewClub />
    </Suspense>
  );
}
