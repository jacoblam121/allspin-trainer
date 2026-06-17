import { useState } from "react";
import mvp1Pack from "./drills/packs/mvp1.json";
import { loadDrillPack } from "./drills/drillLoader.ts";
import { Board } from "./ui/Board.tsx";
import { HoldQueue } from "./ui/HoldQueue.tsx";
import { DrillPanel } from "./ui/DrillPanel.tsx";

const DRILLS = loadDrillPack(mvp1Pack);

export function App() {
  const [selectedDrillId, setSelectedDrillId] = useState(DRILLS[0].id);
  const [showSolution, setShowSolution] = useState(false);

  const drill = DRILLS.find((d) => d.id === selectedDrillId) ?? DRILLS[0];

  function handleSelectDrill(id: string) {
    setSelectedDrillId(id);
    setShowSolution(false);
  }

  function handleReset() {
    setShowSolution(false);
  }

  function handleShowSolution() {
    setShowSolution((v) => !v);
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Allspin Trainer</h1>
        <p className="app__subtitle">MVP 1 — static drill shell</p>
      </header>
      <main className="trainer">
        <div className="trainer__play">
          <Board drill={drill} />
          <HoldQueue drill={drill} />
        </div>
        <DrillPanel
          drills={DRILLS}
          drill={drill}
          selectedDrillId={drill.id}
          onSelectDrill={handleSelectDrill}
          showSolution={showSolution}
          onShowSolution={handleShowSolution}
          onReset={handleReset}
        />
      </main>
    </div>
  );
}
