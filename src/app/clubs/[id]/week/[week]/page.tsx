import { Suspense } from "react";
import { WeekPage } from "./WeekPage";

export const metadata = { title: "Club room", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <WeekPage />
    </Suspense>
  );
}
