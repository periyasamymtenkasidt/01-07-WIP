// MUST be first: installs per-firm localStorage namespacing before any other
// module touches localStorage, so all app data is scoped to the signed-in org.
import "./data/firmScope";

import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { seedDefaultTerms } from "./data/termsStorage";

// Seed default T&C records into localStorage on first launch.
// Runs synchronously before React mounts so every component sees the data.
seedDefaultTerms();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
