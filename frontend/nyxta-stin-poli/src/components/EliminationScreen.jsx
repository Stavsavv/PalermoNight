import { useGame } from "../contexts/GameContext";

export default function EliminationScreen() {
  const { state } = useGame();

  if (!state.eliminatedPlayer) return null;

  const verdictColor =
    state.eliminatedPlayer.verdict === "Guilty"
      ? "text-red-600"
      : "text-green-600";

  return (
    <div className="min-h-screen bg-noirBlue text-white font-noir flex flex-col items-center justify-center p-6">
      <h2 className="text-5xl mb-4">Player Eliminated</h2>
      <div className={`text-6xl font-bold ${verdictColor}`}>
        {state.eliminatedPlayer.nickname} was {state.eliminatedPlayer.verdict}
      </div>
    </div>
  );
}
