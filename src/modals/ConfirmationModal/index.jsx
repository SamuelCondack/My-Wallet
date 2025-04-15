import { motion } from "framer-motion";
import styles from "./styles.module.scss";
import PropTypes from "prop-types";

const ConfirmationModal = ({
  isOpen,
  onRequestClose,
  onConfirm,
  title,
  message,
  identifier,
  afterMessage,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onRequestClose}></div>
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.1 }}
        transition={{ duration: 0.3, ease: "linear" }}
      >
        <h2>{title}</h2>
        <p className={styles.message}>
          {message}
          {identifier && (
            <>
              {` `}
              <b>&rdquo;{identifier}&rdquo;</b>
            </>
          )}
          {afterMessage}
        </p>
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
ConfirmationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  expenseName: PropTypes.string.isRequired,
  identifier: PropTypes.string,
  afterMessage: PropTypes.string,
};

export default ConfirmationModal;
