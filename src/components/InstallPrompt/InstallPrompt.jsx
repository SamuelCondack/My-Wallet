import { useEffect, useState } from "react";
import { isIOS, isStandaloneMode } from "../../utils/pwa";
import styles from "./InstallPrompt.module.scss";

const DISMISS_KEY = "mywallet-install-prompt-dismissed";

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === "true";
    const shouldShow = isIOS() && !isStandaloneMode() && !dismissed;
    setVisible(shouldShow);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className={styles.prompt} role="dialog" aria-label="Instalar aplicativo">
      <button
        type="button"
        className={styles.close}
        onClick={dismiss}
        aria-label="Fechar"
      >
        ×
      </button>
      <p className={styles.title}>Instale o MyWallet</p>
      <p className={styles.text}>
        Toque em <strong>Compartilhar</strong> e depois em{" "}
        <strong>Adicionar à Tela de Início</strong> para usar como app.
      </p>
      <div className={styles.steps}>
        <span>1. Compartilhar</span>
        <span>2. Adicionar à Tela de Início</span>
      </div>
    </div>
  );
}
