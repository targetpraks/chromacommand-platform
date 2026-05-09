import { Suspense } from "react";
import SpotifyClient from "./SpotifyClient";

export default function SpotifyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-on-surface-dim">Loading Spotify…</div>}>
      <SpotifyClient />
    </Suspense>
  );
}
