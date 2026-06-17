import { BOARD_WIDTH, VISIBLE_HEIGHT } from "./engine/constants.ts";

export function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>Allspin Trainer</h1>
        <p className="app__subtitle">MVP 1 — drill sandbox</p>
      </header>
      <main className="app__main">
        <p className="app__placeholder">
          Board: {BOARD_WIDTH}&times;{VISIBLE_HEIGHT} (engine scaffolded, UI in
          a later sprint)
        </p>
      </main>
    </div>
  );
}
