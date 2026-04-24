"use client";

import { useEffect, useRef, useCallback } from "react";

type LiveMessage =
  | { type: "rgb_update"; storeId: string; scope: string; payload: { colour: string; mode: string; brightness: number; zoneId?: string } }
  | { type: "sync_complete"; storeId: string; scope: string; payload: { presetName: string; zoneCount: number } }
  | { type: "audio_update"; storeId: string; payload: { zoneId: string; volume: number; status: string } }
  | { type: "store_status"; storeId: string; payload: { status: string; lastHeartbeat: string } };

export function useLiveSocket(
  onMessage: (msg: LiveMessage) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const wsUrl =
      typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/live/ws`
        : "ws://localhost:4000/live/ws";

    const ws = new WebSocket(wsUrl.replace(/:\d+/, ":4000"));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "subscribe", topic: "all" }));
      console.log("🔌 Live socket connected");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as LiveMessage;
        if (msg.type === "rgb_update" || msg.type === "sync_complete" || msg.type === "audio_update" || msg.type === "store_status") {
          onMessage(msg);
        }
      } catch (e) {
        // ignore non-data messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((action: string, topic: string) => {
    wsRef.current?.send(JSON.stringify({ action, topic }));
  }, []);

  return { send, connected: !!wsRef.current };
}
