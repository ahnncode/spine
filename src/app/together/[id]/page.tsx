import { Suspense } from "react";
import { ReadAlongPage } from "./ReadAlongPage";

export default function Page() {
  return (
    <Suspense>
      <ReadAlongPage />
    </Suspense>
  );
}
