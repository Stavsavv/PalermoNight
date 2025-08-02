import { useGame } from "../contexts/GameContext";
import { useState } from "react";

export default function DayPhase() {
  const { state, send } = useGame();
  const [voteTarget, setVoteTarget] = useState(null);
  const [chatInput, setChatInput] = useState("");

  const alivePlayers = state.players.filter((p) => p.isAlive);

  const me = state.players.find((p) => p.id === state.playerId);

  const canVote = me && me.isAlive && !me.isMuted && !me.isSilenced;

  function handleVote() {
    if (!voteTarget) return alert("Select a player to vote");
    send({ type: "vote", targetId: voteTarget });
  }

  function handleChatSubmit(e) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    send({ type: "chat", message: chatInput.trim() });
    setChatInput("");
  }

  function handleMayorOverride() {
    if (!voteTarget) return alert("Select a player to override vote");
    send({
      type: "player-action",
      action: "override-vote",
      targetId: voteTarget,
    });
  }

  return (
    <div className="min-h-screen bg-noirBlue text-white font-noir p-6 flex flex-col">
      <h2 className="text-4xl mb-4">Day Phase — Discuss and Vote</h2>

      <div className="flex-grow grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-noirGray p-4 rounded overflow-y-auto max-h-[400px]">
          <h3 className="mb-2 font-bold">Players</h3>
          <ul>
            {alivePlayers.map((p) => (
              <li
                key={p.id}
                className={`cursor-pointer px-2 py-1 rounded ${
                  voteTarget === p.id ? "bg-noirGold text-noirBlue" : ""
                }`}
                onClick={() => setVoteTarget(p.id)}
              >
                {p.nickname}
              </li>
            ))}
          </ul>
          <button
            onClick={handleVote}
            disabled={!canVote || !voteTarget}
            className={`mt-4 w-full px-4 py-2 rounded font-bold ${
              canVote && voteTarget
                ? "bg-noirGold text-noirBlue hover:bg-yellow-400"
                : "bg-gray-600 cursor-not-allowed"
            }`}
          >
            Vote
          </button>

          {state.role === "Mayor" && !state.mayorUsedOverride && (
            <button
              onClick={handleMayorOverride}
              disabled={!voteTarget}
              className="mt-2 w-full px-4 py-2 rounded bg-red-700 hover:bg-red-600 font-bold"
            >
              Override Vote (Once)
            </button>
          )}

          {!canVote && (
            <p className="mt-4 text-red-500 font-semibold">
              You cannot vote this round.
            </p>
          )}
        </div>

        <div className="col-span-2 flex flex-col bg-noirGray rounded p-4">
          <h3 className="font-bold mb-2">Chat</h3>
          <div className="flex-grow overflow-y-auto mb-2 max-h-[300px] space-y-1">
            {state.chat.map((msg, i) => (
              <div key={i} className="text-sm">
                <strong>{msg.nickname}: </strong>
                <span>{msg.message}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              className="flex-grow px-3 py-2 rounded bg-noirBlue text-white"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={!me || !me.isAlive}
            />
            <button
              type="submit"
              className="bg-noirGold px-4 py-2 rounded font-bold text-noirBlue hover:bg-yellow-400"
              disabled={!me || !me.isAlive}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
