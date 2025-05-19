import { api, atom, injectEffect, injectSignal } from "@zedux/react";

/**
 * A singleton atom that tracks the browser's online status.
 */
export const onlineManagerAtom = atom("onlineManager", () => {
  // Initialize signal with the current online status
  const isOnlineSignal = injectSignal<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  injectEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      isOnlineSignal.set(true);
      console.log("App is online.");
    };
    const handleOffline = () => {
      isOnlineSignal.set(false);
      console.log("App is offline.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []); // Run only once

  return api(isOnlineSignal);
});
