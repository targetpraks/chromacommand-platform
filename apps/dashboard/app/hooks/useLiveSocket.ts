"use client";

import { useEffect, useRef, useCallback } from "react";
import { getToken } from "../lib/trpc";

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
    const token = getToken();
    if (!token) {
      // Defer connection until the user logs in. The MatrixView re-mounts on
      // route changes which retriggers this hook.
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const wsBase = apiUrl.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/live/ws?token=${encodeURIComponent(token)}`);
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
