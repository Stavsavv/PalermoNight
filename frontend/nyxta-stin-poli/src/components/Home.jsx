import { useState } from "react";
import { useGame } from "../contexts/GameContext";

export default function Home() {
  const { send, state } = useGame();
  const [nickname, setNickname] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");

  function handleCreate() {
    if (!nickname.trim()) return alert("Enter a nickname");
    send({ type: "create-room", nickname });
  }

  function handleJoin() {
    if (!nickname.trim()) return alert("Enter a nickname");
    if (!roomIdInput.trim()) return alert("Enter a room code");
    send({ type: "join-room", roomId: roomIdInput.trim(), nickname });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-noirBlue text-white font-noir p-6">
      <h1 className="text-5xl mb-6">Νύχτα στην Πόλη</h1>

      <input
        type="text"
        placeholder="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="mb-4 px-4 py-2 rounded bg-noirGray text-white w-64"
      />

      <button
        onClick={handleCreate}
        className="mb-4 px-6 py-2 bg-noirGold text-noirBlue font-bold rounded hover:bg-yellow-400 transition"
      >
        Create Game
      </button>

      <div className="mb-4 text-gray-400">OR</div>

      <input
        type="text"
        placeholder="Room Code"
        value={roomIdInput}
        onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
        className="mb-2 px-4 py-2 rounded bg-noirGray text-white w-64 text-center tracking-widest"
        maxLength={6}
      />

      <button
        onClick={handleJoin}
        className="px-6 py-2 bg-noirGold text-noirBlue font-bold rounded hover:bg-yellow-400 transition"
      >
        Join Game
      </button>
    </div>
  );
}
