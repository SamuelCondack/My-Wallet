import { motion } from "framer-motion";
import styles from "./styles.module.scss";
import PropTypes from "prop-types";

const ConfirmChangeEarnings = ({ isOpen, onRequestClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onRequestClose}></div>

      <motion.div
        className={styles.modal}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <h2>Confirm Change</h2>
        <p>Are you sure you want to change the earnings for this month?</p>
        <div className={styles.buttons}>
          <button className={styles.confirmButton} onClick={onConfirm}>
            Yes
          </button>
          <button className={styles.cancelButton} onClick={onRequestClose}>
            No
          </button>
        </div>
      </motion.div>
    </>
  );
};
ConfirmChangeEarnings.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default ConfirmChangeEarnings;
