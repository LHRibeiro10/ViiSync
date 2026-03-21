import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AnalyticsPeriodProvider } from "./contexts/AnalyticsPeriodContext";
import { AuthSessionProvider } from "./contexts/AuthSessionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthSessionProvider>
        <AnalyticsPeriodProvider>
          <App />
        </AnalyticsPeriodProvider>
      </AuthSessionProvider>
    </ThemeProvider>
  </React.StrictMode>
);
