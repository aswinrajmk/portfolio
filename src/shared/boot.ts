import { createElement, StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource-variable/newsreader/index.css";
import "../styles/tokens.css";
import "../styles/base.css";

export function mount(Page: ComponentType) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");
  createRoot(root).render(createElement(StrictMode, null, createElement(Page)));
}
