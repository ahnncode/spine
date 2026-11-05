"use client";

import { RequireAuth } from "@/components/Auth";
import { PickBooks } from "@/components/PickBooks";

export default function StartPage() {
  return (
    <RequireAuth>
      <PickBooks />
    </RequireAuth>
  );
}
