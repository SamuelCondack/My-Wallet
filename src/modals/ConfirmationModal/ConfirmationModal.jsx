import React from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import styles from "./styles.module.scss";

const ConfirmationModal = ({
  isOpen,
  onRequestClose,
  onConfirm,
  title,
  message,
  identifier,
  expenseName,
  isEditModal,
  isSubmitting
}) => {
  if (!isOpen) return null;

  const MessageContainer = isEditModal ? 'div' : 'p';

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
        <MessageContainer className={styles.message}>
          {message}
          {!isEditModal && (
            <>
              {` `}
              <b style={{ whiteSpace: "nowrap" }}>
                &rdquo;{expenseName || identifier}&rdquo;
              </b>
              {` `}?
            </>
          )}
        </MessageContainer>
        <div className={styles.buttons}>
          <button 
            className={styles.confirmButton} 
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing..." : "Yes"}
          </button>
          <button 
            className={styles.cancelButton} 
            onClick={onRequestClose}
            disabled={isSubmitting}
          >
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
  message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
  identifier: PropTypes.string,
  expenseName: PropTypes.string,
  isEditModal: PropTypes.bool,
  isSubmitting: PropTypes.bool
};

export default ConfirmationModal; 