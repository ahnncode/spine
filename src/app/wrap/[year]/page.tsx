import { Suspense } from "react";
import { Wrap } from "./Wrap";

export default function Page() {
  return (
    <Suspense>
      <Wrap />
    </Suspense>
  );
}
