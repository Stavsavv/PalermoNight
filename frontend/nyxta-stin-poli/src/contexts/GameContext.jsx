import React, { createContext, useContext, useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

const GameContext = createContext();

export function GameProvider({ children }) {
  const { isConnected, messages, sendMessage } = useWebSocket(
    "ws://localhost:8080"
  );
  const [state, setState] = useState({
    connected: false,
    playerId: null,
    roomId: null,
    isHost: false,
    players: [],
    role: null,
    phase: "lobby", // lobby, night, day, elimination, ended
    chat: [],
    rolesEnabled: { doctor: true },
    eliminatedPlayer: null,
    mayorUsedOverride: false,
  });

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    handleServerMessage(lastMsg);
  }, [messages]);

  function handleServerMessage(data) {
    switch (data.type) {
      case "room-created":
      case "joined-room":
        setState((s) => ({
          ...s,
          playerId: data.playerId,
          roomId: data.roomId,
          isHost: data.host,
          players: data.players,
          phase: "lobby",
        }));
        break;

      case "player-joined":
        setState((s) => ({
          ...s,
          players: [
            ...s.players,
            { id: data.playerId, nickname: data.nickname, isAlive: true },
          ],
        }));
        break;

      case "player-left":
        setState((s) => ({
          ...s,
          players: s.players.filter((p) => p.id !== data.playerId),
        }));
        break;

      case "roles-updated":
        setState((s) => ({ ...s, rolesEnabled: data.rolesEnabled }));
        break;

      case "role-assignment":
        setState((s) => ({ ...s, role: data.role }));
        break;

      case "game-started":
        setState((s) => ({
          ...s,
          phase: "night",
          players: data.players,
          rolesEnabled: data.rolesEnabled,
          eliminatedPlayer: null,
        }));
        break;

      case "phase-change":
        setState((s) => ({
          ...s,
          phase: data.phase,
          eliminatedPlayer: null,
        }));
        break;

      case "player-eliminated":
        setState((s) => ({
          ...s,
          eliminatedPlayer: {
            id: data.playerId,
            nickname: data.nickname,
            verdict: data.verdict,
          },
          players: s.players.map((p) =>
            p.id === data.playerId ? { ...p, isAlive: false } : p
          ),
          phase: "elimination",
        }));
        break;

      case "game-ended":
        setState((s) => ({
          ...s,
          phase: "ended",
          winner: data.winner,
          players: data.players,
        }));
        break;

      case "chat":
        setState((s) => ({
          ...s,
          chat: [
            ...s.chat,
            {
              playerId: data.playerId,
              nickname: data.nickname,
              message: data.message,
            },
          ],
        }));
        break;

      case "mayor-override":
        setState((s) => ({
          ...s,
          mayorUsedOverride: true,
        }));
        break;

      case "game-restarted":
        setState((s) => ({
          ...s,
          phase: "lobby",
          players: data.players,
          rolesEnabled: data.rolesEnabled,
          role: null,
          eliminatedPlayer: null,
          mayorUsedOverride: false,
          chat: [],
        }));
        break;

      default:
        console.log("Unhandled message", data);
    }
  }

  const send = (msg) => {
    sendMessage(msg);
  };

  return (
    <GameContext.Provider value={{ state, send, isConnected }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
