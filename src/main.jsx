// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import FunRunApp from "./FunRunApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <FunRunApp />
  </React.StrictMode>
);
