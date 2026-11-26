import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { syncDocumentThemeFromStorage } from "./lib/session";
import "./index.css";

syncDocumentThemeFromStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
