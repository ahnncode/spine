import { Suspense } from "react";
import { RoomPage } from "./RoomPage";

export const metadata = { title: "Chapter room", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense>
      <RoomPage />
    </Suspense>
  );
}
