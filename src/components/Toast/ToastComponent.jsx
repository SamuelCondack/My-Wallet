import { ToastContainer, Slide } from "react-toastify";
import styles from "./ToastComponent.module.scss";

export default function ToastComponent() {
  return (
    <ToastContainer
      className={styles.toastContainer}
      position="bottom-right"
      transition={Slide}
      autoClose={3000}
      hideProgressBar={false}
      closeOnClick
      pauseOnHover={false}
    />
  );
}
