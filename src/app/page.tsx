import { Suspense } from "react";
import { MapView } from "@/components/MapView";

export default function Home() {
  return (
    <Suspense>
      <MapView />
    </Suspense>
  );
}
