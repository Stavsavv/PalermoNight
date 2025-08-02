import { useGame } from "./contexts/GameContext";
import Home from "./components/Home";
import Lobby from "./components/Lobby";
import RoleScreen from "./components/RoleScreen";
import NightPhase from "./components/NightPhase";
import DayPhase from "./components/DayPhase";
import EliminationScreen from "./components/EliminationScreen";
import GameEnd from "./components/GameEnd";

export default function App() {
  const { state } = useGame();

  if (!state.roomId) {
    return <Home />;
  }

  switch (state.phase) {
    case "lobby":
      return <Lobby />;
    case "night":
      return <NightPhase />;
    case "day":
      return <DayPhase />;
    case "elimination":
      return <EliminationScreen />;
    case "ended":
      return <GameEnd />;
    default:
      return <div>Loading...</div>;
  }
}
