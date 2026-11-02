import { Suspense } from "react";
import { BookPage } from "./BookPage";

export default function Page() {
  return (
    <Suspense>
      <BookPage />
    </Suspense>
  );
}
