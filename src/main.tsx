import React from "react";
import {createRoot} from "react-dom/client";
import App from "./pickup/PickupMerchantApp";
import {PickupErrorBoundary} from "./pickup/PickupErrorBoundary";
import "./index.css";

// The pilot must not activate legacy Firestore logging, cache reset or mutation replay.
createRoot(document.getElementById("root")!).render(
 <React.StrictMode><PickupErrorBoundary><App/></PickupErrorBoundary></React.StrictMode>,
);
