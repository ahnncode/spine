import { Suspense } from "react";
import { LibraryPage } from "./LibraryPage";

export default function Page() {
  return (
    <Suspense>
      <LibraryPage />
    </Suspense>
  );
}
