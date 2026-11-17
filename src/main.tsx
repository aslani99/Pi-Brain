import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializePiSdk } from "./services/pi";
import { initializeLocale } from "./i18n/config";
import "./styles.css";
import "./theme.css";

async function bootstrap() {
  await Promise.all([initializePiSdk(), initializeLocale()]);
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><App /></React.StrictMode>
  );
}

void bootstrap();
