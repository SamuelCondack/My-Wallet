import { ToastContainer, Slide } from "react-toastify";
import styles from "./ToastComponent.module.scss";

export default function ToastComponent() {
  return (
    <ToastContainer
      className={styles.container}
      toastClassName={styles.toast}
      progressClassName={styles.progress}
      position="top-center"
      transition={Slide}
      autoClose={3000}
      hideProgressBar={false}
      closeOnClick
      closeButton={false}
      pauseOnHover={false}
      pauseOnFocusLoss={false}
      newestOnTop
      limit={3}
      draggable
      draggableDirection="y"
      draggablePercent={40}
      theme="light"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 52px)",
      }}
    />
  );
}
