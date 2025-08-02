import { useGame } from "../contexts/GameContext";
import { roleCards } from "../utils/cards";

export default function GameEnd() {
  const { state, send } = useGame();

  function handleRestart() {
    send({ type: "restart-game" });
  }

  return (
    <div className="min-h-screen bg-noirBlue text-white font-noir p-6 flex flex-col items-center">
      <h2 className="text-5xl mb-6">Game Over</h2>

      <p className="mb-4 text-2xl">
        Winner: <span className="font-bold">{state.winner}</span>
      </p>

      <h3 className="text-3xl mb-4">Players & Roles:</h3>
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {state.players.map((p) => {
          const card = roleCards[p.role] || {
            emoji: "?",
            color: "bg-gray-600",
          };
          return (
            <div
              key={p.id}
              className="flex flex-col items-center p-4 rounded bg-noirGray"
            >
              <div
                className={`text-6xl rounded-xl px-6 py-3 mb-2 ${card.color} shadow-lg`}
              >
                {card.emoji}
              </div>
              <div className="text-lg">{p.nickname}</div>
              <div className="text-sm opacity-70">{p.role}</div>
            </div>
          );
        })}
      </div>

      {state.isHost && (
        <button
          onClick={handleRestart}
          className="mt-8 bg-noirGold text-noirBlue font-bold px-8 py-3 rounded hover:bg-yellow-400 transition"
        >
          Restart Game
        </button>
      )}
    </div>
  );
}
