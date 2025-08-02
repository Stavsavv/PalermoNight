import { useGame } from "../contexts/GameContext";
import { roleCards } from "../utils/cards";

export default function RoleScreen() {
  const { state } = useGame();
  const roleInfo = roleCards[state.role] || {
    emoji: "?",
    color: "bg-gray-600",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-noirBlue text-white font-noir p-6">
      <h2 className="text-5xl mb-6">Your Role</h2>
      <div
        className={`text-9xl rounded-xl px-12 py-8 ${roleInfo.color} shadow-lg`}
      >
        {roleInfo.emoji}
      </div>
      <div className="mt-6 text-xl">
        <strong>{state.role}</strong>
      </div>
    </div>
  );
}
