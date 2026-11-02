import { Suspense } from "react";
import { JoinPage } from "./JoinPage";

export const metadata = {
  title: "You’re invited to Spine",
  description: "Rank the books you read, see what friends are reading, and find readers with your taste.",
};

export default function Page() {
  return (
    <Suspense>
      <JoinPage />
    </Suspense>
  );
}
