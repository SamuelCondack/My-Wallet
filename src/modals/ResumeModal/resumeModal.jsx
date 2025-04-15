import { useEffect } from "react";
import { motion } from "framer-motion";
import styles from "./resumeModal.module.scss";
import PropTypes from "prop-types";

const ResumeModal = ({
  isOpen,
  selectedExpense,
  onConfirm,
  onRequestClose,
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
        <h2>Resume Expense</h2>
        <p className={styles.message}>
          Are you sure you want to resume the expense
          <b style={{ whiteSpace: "nowrap" }}>
            {` `}&rdquo;{selectedExpense?.name} &rdquo;
          </b>
        </p>
        <div className={styles.buttons}>
          <button className={styles.confirmButton} onClick={onConfirm}>
            Confirm
          </button>
          <button className={styles.cancelButton} onClick={onRequestClose}>
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
};

ResumeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  selectedExpense: PropTypes.object,
  onConfirm: PropTypes.func.isRequired,
  onRequestClose: PropTypes.func.isRequired,
};

export default ResumeModal;
