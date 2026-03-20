import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AnalyticsPeriodProvider } from "./contexts/AnalyticsPeriodContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AnalyticsPeriodProvider>
        <App />
      </AnalyticsPeriodProvider>
    </ThemeProvider>
  </React.StrictMode>
);
