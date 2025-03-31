import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContexts() {
      try {
        const result = await invoke<string[]>("get_kube_contexts");
        setContexts(result);
        setError(null); // Clear previous errors
      } catch (err) {
        console.error("Error fetching kube contexts:", err);
        setError(typeof err === 'string' ? err : "An unknown error occurred.");
      }
    }
    loadContexts();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <main className="container">
      <h1>Available Kubernetes Contexts</h1>

      {error && (
        <div className="error">
          <p>Error loading contexts:</p>
          <pre>{error}</pre>
        </div>
      )}

      {contexts.length > 0 ? (
        <ul>
          {contexts.map((context) => (
            <li key={context}>{context}</li>
          ))}
        </ul>
      ) : (
        !error && <p>Loading contexts...</p>
      )}
    </main>
  );
}

export default App;
