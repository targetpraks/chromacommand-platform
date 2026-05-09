"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "../lib/trpc";
import { Music2, Play, Pause, ExternalLink, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { Section, SectionHeader, Button, Badge } from "../components/ui";

export default function SpotifyPage() {
  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const accounts = trpc.spotify.listAccounts.useQuery();
  const authorizeUrl = trpc.spotify.authorizeUrl.useQuery({ scope: "global", targetId: "all" });
  const playlists = trpc.spotify.listPlaylists.useQuery(
    { scope: "global", targetId: "all", limit: 50 },
    { enabled: (accounts.data?.length ?? 0) > 0, retry: false }
  );
  const devices = trpc.spotify.listDevices.useQuery(
    { scope: "global", targetId: "all" },
    { enabled: (accounts.data?.length ?? 0) > 0, retry: false }
  );
  const nowPlaying = trpc.spotify.nowPlaying.useQuery(
    { scope: "global", targetId: "all" },
    { enabled: (accounts.data?.length ?? 0) > 0, refetchInterval: 5000, retry: false }
  );

  const playToScope = trpc.spotify.playToScope.useMutation({
    onSuccess: () => utils.spotify.nowPlaying.invalidate(),
  });
  const pause = trpc.spotify.pause.useMutation({
    onSuccess: () => utils.spotify.nowPlaying.invalidate(),
  });
  const disconnect = trpc.spotify.disconnect.useMutation({
    onSuccess: () => utils.spotify.listAccounts.invalidate(),
  });

  const [scope, setScope] = useState<"global" | "region" | "store">("global");
  const [targetId, setTargetId] = useState("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const search = trpc.spotify.search.useQuery(
    { q: searchQuery, type: "playlist", limit: 12 },
    { enabled: searchQuery.length > 2 }
  );

  const status = searchParams.get("spotify");
  const [banner, setBanner] = useState<{ kind: "ok" | "error"; msg: string } | null>(null);
  useEffect(() => {
    if (status === "ok") setBanner({ kind: "ok", msg: "Spotify account connected." });
    else if (status === "error") setBanner({ kind: "error", msg: searchParams.get("reason") ?? "Connection failed" });
  }, [status, searchParams]);

  const isConnected = (accounts.data?.length ?? 0) > 0;

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-8 flex items-center gap-3">
        <Music2 className="w-7 h-7 text-spotify" />
        <div>
          <h1 className="text-2xl font-semibold">Spotify</h1>
          <p className="text-sm text-on-surface-dim">Stream playlists across stores via Spotify Connect.</p>
        </div>
      </header>

      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-lg border flex items-center gap-2 ${
          banner.kind === "ok" ? "border-success/40 bg-success-subtle text-success"
                               : "border-error/40 bg-error-subtle text-error"
        }`}>
          {banner.kind === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {banner.msg}
        </div>
      )}

      {!isConnected && (
        <section className="mb-6 cc-section p-6 text-center">
          <Music2 className="w-12 h-12 text-spotify mx-auto mb-3" />
          <h2 className="text-lg font-medium text-on-dark mb-2">Connect your Spotify account</h2>
          <p className="text-sm text-on-surface-dim mb-5 max-w-md mx-auto">
            ChromaCommand will be able to read your playlists, control playback, and stream to all stores.
            You can disconnect at any time.
          </p>
          {authorizeUrl.data?.url ? (
            <a
              href={authorizeUrl.data.url}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-spotify hover:opacity-90 text-on-dark font-medium transition"
            >
              <Music2 className="w-4 h-4" />
              Connect Spotify
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <span className="text-on-surface-dim text-sm">Loading authorize URL…</span>
          )}
        </section>
      )}

      {isConnected && (
        <>
          <section className="mb-6 grid grid-cols-3 gap-4">
            {(accounts.data ?? []).map((a: any) => (
              <div key={a.id} className="cc-card-static">
                <div className="flex items-center gap-2 mb-1">
                  <Music2 className="w-4 h-4 text-spotify" />
                  <div className="text-sm font-medium text-on-dark truncate">{a.displayName ?? a.spotifyUserId}</div>
                </div>
                <div className="text-xs text-on-surface-dim">
                  {a.scope}:{a.targetId} · {a.productTier ?? "?"}
                  {a.productTier !== "premium" && (
                    <span className="block text-warning mt-1">⚠ Premium required for cross-store playback</span>
                  )}
                </div>
                <button
                  onClick={() => disconnect.mutate({ accountId: a.id })}
                  className="mt-2 text-xs text-red-300 hover:underline"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </section>

          {nowPlaying.data?.item && (
            <section className="mb-6 cc-section border-spotify/40 p-4 flex items-center gap-4">
              {nowPlaying.data.item.album?.images?.[0]?.url && (
                <img src={nowPlaying.data.item.album.images[0].url} alt="" className="w-16 h-16 rounded" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-spotify">Now playing</div>
                <div className="text-sm text-on-dark truncate">{nowPlaying.data.item.name}</div>
                <div className="text-xs text-on-surface-dim truncate">
                  {nowPlaying.data.item.artists?.map((a: any) => a.name).join(", ")}
                </div>
              </div>
              <Button onClick={() => pause.mutate({ scope: "global", targetId: "all" })} className="flex items-center gap-2">
                <Pause className="w-4 h-4" /> Pause all
              </Button>
            </section>
          )}

          <Section className="mb-6 p-4">
            <h3 className="text-sm font-medium text-on-surface mb-3">Playback target</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="cc-input"
              >
                <option value="global">All stores</option>
                <option value="region">Region</option>
                <option value="store">Single store</option>
              </select>
              <input
                value={scope === "global" ? "all" : targetId}
                onChange={(e) => setTargetId(e.target.value)}
                disabled={scope === "global"}
                className="cc-input disabled:opacity-50"
                placeholder={scope === "region" ? "cape-town" : "pp-a01"}
              />
              <select
                value={selectedDeviceId ?? ""}
                onChange={(e) => setSelectedDeviceId(e.target.value || undefined)}
                className="cc-input"
              >
                <option value="">Active device (auto)</option>
                {(devices.data ?? []).map((d: any) => (
                  <option key={d.id} value={d.id ?? ""}>{d.name} ({d.type})</option>
                ))}
              </select>
            </div>
          </Section>

          <Section className="mb-6 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-on-surface-dim" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Spotify (playlists)…"
                className="flex-1 cc-input"
              />
            </div>
            {search.data && search.data.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {search.data.filter((p: any) => p).map((p: any) => (
                  <PlaylistCard
                    key={p.id}
                    playlist={p}
                    onPlay={() =>
                      playToScope.mutate({
                        scope,
                        targetId: scope === "global" ? "all" : targetId,
                        playlistUri: p.uri,
                        deviceId: selectedDeviceId,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </Section>

          <Section>
            <SectionHeader>
              Your playlists ({playlists.data?.total ?? 0})
            </SectionHeader>
            {playlists.isLoading && <div className="p-6 text-center text-on-surface-dim text-sm">Loading playlists…</div>}
            {playlists.error && (
              <div className="p-6 text-center text-error text-sm">
                {(playlists.error as unknown as Error).message}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 p-4">
              {(playlists.data?.items ?? []).map((p: any) => (
                <PlaylistCard
                  key={p.id}
                  playlist={p}
                  onPlay={() =>
                    playToScope.mutate({
                      scope,
                      targetId: scope === "global" ? "all" : targetId,
                      playlistUri: p.uri,
                      deviceId: selectedDeviceId,
                    })
                  }
                />
              ))}
            </div>
          </Section>

          {playToScope.isError && (
            <div className="mt-4 px-4 py-3 rounded-lg border border-error/40 bg-error-subtle text-red-300 text-sm">
              {(playToScope.error as unknown as Error).message}
            </div>
          )}
          {playToScope.data && (
            <div className="mt-4 px-4 py-3 rounded-lg border border-success/40 bg-success-subtle text-success text-sm">
              Dispatched to {playToScope.data.affectedStores} store(s)
              {playToScope.data.directPlayback?.ok && " · live playback started on your active Spotify device"}
              {(playToScope.data as any).directPlayback?.error && (
                <span className="block text-xs text-warning mt-1">
                  Direct playback note: {(playToScope.data as any).directPlayback.error}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlaylistCard({ playlist, onPlay }: { playlist: any; onPlay: () => void }) {
  const imageUrl = playlist.imageUrl ?? playlist.images?.[0]?.url;
  const trackCount = playlist.trackCount ?? playlist.tracks?.total ?? 0;
  return (
    <div className="rounded-lg border border-border-medium bg-dark overflow-hidden hover:border-spotify/40 transition">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-panel-hover flex items-center justify-center">
          <Music2 className="w-8 h-8 text-on-surface-dim" />
        </div>
      )}
      <div className="p-3">
        <div className="text-sm text-on-dark truncate">{playlist.name}</div>
        <div className="text-xs text-on-surface-dim truncate">{trackCount} tracks{playlist.owner && ` · ${playlist.owner}`}</div>
        <button
          onClick={onPlay}
          className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-spotify hover:opacity-90 text-on-dark text-xs font-medium transition"
        >
          <Play className="w-3 h-3" /> Play to scope
        </button>
      </div>
    </div>
  );
}