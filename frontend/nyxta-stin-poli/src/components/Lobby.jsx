import { useGame } from "../contexts/GameContext";

export default function Lobby() {
  const { state, send } = useGame();

  function handleStart() {
    send({ type: "start-game" });
  }

  return (
    <div className="p-6 text-white font-noir bg-noirBlue min-h-screen flex flex-col items-center">
      <h2 className="text-4xl mb-4">Lobby — Room {state.roomId}</h2>

      <div className="mb-4 space-y-2 w-64">
        {state.players.map((p) => (
          <div
            key={p.id}
            className="flex justify-between items-center bg-noirGray rounded px-4 py-2"
          >
            <span>{p.nickname}</span>
            {p.isHost && <span className="text-noirGold font-bold">Host</span>}
            {!p.isAlive && <span className="text-red-600 font-bold">Dead</span>}
          </div>
        ))}
      </div>

      {state.isHost && (
        <button
          onClick={handleStart}
          className="bg-noirGold text-noirBlue font-bold px-6 py-2 rounded hover:bg-yellow-400 transition"
        >
          Start Game
        </button>
      )}

      {!state.isHost && (
        <div className="mt-4 text-gray-400">Waiting for host to start...</div>
      )}
    </div>
  );
}
