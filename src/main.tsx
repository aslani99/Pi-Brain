import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializePiSdk } from "./services/pi";
import "./styles.css";
import "./theme.css";
import "./i18n/config";

// The Pi SDK script is loaded in index.html. Initialize once before the UI can authenticate.
initializePiSdk();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
