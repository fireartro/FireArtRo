import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/editorial-refresh.css";
import "@/styles/night-runway.css";
import App from "@/App";

const container = document.getElementById("root");
const application = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
if (document.documentElement.dataset.fireartSsr === 'true') {
  ReactDOM.hydrateRoot(container, application);
} else {
  ReactDOM.createRoot(container).render(application);
}
