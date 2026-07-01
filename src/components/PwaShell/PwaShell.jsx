import { useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import OfflineBanner from "../OfflineBanner/OfflineBanner";
import InstallPrompt from "../InstallPrompt/InstallPrompt";
import ToastComponent from "../Toast/ToastComponent";

export default function PwaShell({ children }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      import("virtual:pwa-register").then(({ registerSW }) => {
        registerSW({
          immediate: true,
          onOfflineReady() {
            toast.info("MyWallet pronto para uso offline.", {
              toastId: "pwa-offline-ready",
            });
          },
          onNeedRefresh() {
            toast.info("Nova versão disponível. Recarregue para atualizar.", {
              toastId: "pwa-need-refresh",
            });
          },
        });
      });
    }
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
