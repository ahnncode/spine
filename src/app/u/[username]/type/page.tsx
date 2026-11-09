import { Suspense } from "react";
import { FriendTypePage } from "./FriendTypePage";

export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <FriendTypePage />
    </Suspense>
  );
}
