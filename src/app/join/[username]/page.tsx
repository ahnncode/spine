import { Suspense } from "react";
import { JoinPage } from "./JoinPage";

export const metadata = {
  title: "You’re invited to readread",
  description: "Rank the books you read, see what friends are reading, and find readers with your taste.",
  // Invite pages are for the person invited; search engines should show the home page instead.
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <Suspense>
      <JoinPage />
    </Suspense>
  );
}
