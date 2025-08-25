// src/index.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import FunRunApp from "./FunRunApp";
import "./index.css"; // make sure Tailwind CSS is imported

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <FunRunApp />
  </React.StrictMode>
);
