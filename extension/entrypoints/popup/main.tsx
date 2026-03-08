import React from "react";
import ReactDOM from "react-dom/client";
import "../../assets/tailwind.css";

function App() {
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium shadow-sm">
        OpenParty
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
