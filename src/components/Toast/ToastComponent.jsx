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
      autoClose={3200}
      hideProgressBar={false}
      closeOnClick
      closeButton={false}
      pauseOnHover
      newestOnTop
      limit={3}
      draggable="touch"
      draggablePercent={60}
      theme="light"
      style={{
        top: "max(12px, env(safe-area-inset-top, 0px))",
      }}
    />
  );
}
