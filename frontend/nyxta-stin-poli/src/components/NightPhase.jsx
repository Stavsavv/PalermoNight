import { useGame } from "../contexts/GameContext";
import { useState } from "react";

export default function NightPhase() {
  const { state, send } = useGame();
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [butcherChoice, setButcherChoice] = useState("mute"); // mute or silence

  const alivePlayers = state.players.filter(
    (p) => p.isAlive && p.id !== state.playerId
  );

  const myRole = state.role;

  function sendAction() {
    if (!selectedTarget) return alert("Select a player");
    if (myRole === "Butcher") {
      send({
        type: "player-action",
        action: "choose-target",
        targetId: selectedTarget,
        mute: butcherChoice === "mute",
        silence: butcherChoice === "silence",
      });
    } else if (myRole === "Doctor") {
      send({
        type: "player-action",
        action: "choose-target",
        targetId: selectedTarget,
      });
    }
  }

  if (
    !["Red J", "Black J", "Policeman", "Snitch", "Butcher", "Doctor"].includes(
      myRole
    )
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white font-noir bg-noirBlue">
        <h2 className="text-4xl">Night phase — Wait for morning</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noirBlue text-white font-noir p-6">
      <h2 className="text-4xl mb-6">Night Phase - Your Action</h2>

      {(myRole === "Butcher" || myRole === "Doctor") && (
        <>
          <p>Select a player:</p>
          <select
            className="mb-4 px-4 py-2 rounded bg-noirGray text-white"
            value={selectedTarget || ""}
            onChange={(e) => setSelectedTarget(e.target.value)}
          >
            <option value="" disabled>
              -- Select Player --
            </option>
            {alivePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </>
      )}

      {myRole === "Butcher" && (
        <div className="mb-4">
          <label className="mr-4">
            <input
              type="radio"
              name="butcherChoice"
              value="mute"
              checked={butcherChoice === "mute"}
              onChange={() => setButcherChoice("mute")}
            />
            Mute (no talking)
          </label>
          <label>
            <input
              type="radio"
              name="butcherChoice"
              value="silence"
              checked={butcherChoice === "silence"}
              onChange={() => setButcherChoice("silence")}
            />
            Silence (no voting)
          </label>
        </div>
      )}

      <button
        onClick={sendAction}
        className="bg-noirGold text-noirBlue font-bold px-6 py-2 rounded hover:bg-yellow-400 transition"
      >
        Submit Action
      </button>
    </div>
  );
}
