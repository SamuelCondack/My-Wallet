import { useEffect } from "react";
import OfflineBanner from "../OfflineBanner/OfflineBanner";
import InstallPrompt from "../InstallPrompt/InstallPrompt";
import ToastComponent from "../Toast/ToastComponent";

export default function PwaShell({ children }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length === 0) {
        return;
      }

      Promise.all(registrations.map((registration) => registration.unregister())).then(() => {
        if ("caches" in window) {
          caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
        }
      });
    });
  }, []);

  return (
    <>
      <OfflineBanner />
      <ToastComponent />
      {children}
      <InstallPrompt />
    </>
  );
}
