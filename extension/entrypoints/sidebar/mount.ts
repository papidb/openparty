import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import Sidebar from "./Sidebar";
import sidebarStyles from "./sidebar.css?inline";

const SIDEBAR_HOST_ID = "openparty-sidebar-host";
const SIDEBAR_CONTAINER_ID = "openparty-sidebar";

let sidebarRoot: Root | null = null;

export function mountSidebar(): void {
  if (document.getElementById(SIDEBAR_HOST_ID)) {
    return;
  }

  if (!document.body) {
    return;
  }

  const host = document.createElement("div");
  host.id = SIDEBAR_HOST_ID;

  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: "360px",
    maxWidth: "100vw",
    height: "100vh",
    zIndex: "2147483647",
    pointerEvents: "none"
  });

  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = sidebarStyles;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.id = SIDEBAR_CONTAINER_ID;
  container.style.pointerEvents = "auto";
  shadow.appendChild(container);

  sidebarRoot = createRoot(container);
  sidebarRoot.render(createElement(Sidebar, { onClose: unmountSidebar }));
}

export function unmountSidebar(): void {
  sidebarRoot?.unmount();
  sidebarRoot = null;

  const host = document.getElementById(SIDEBAR_HOST_ID);
  host?.remove();
}
