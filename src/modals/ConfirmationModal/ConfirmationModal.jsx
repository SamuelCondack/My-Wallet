import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useT } from "../../i18n/useT";
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
  const t = useT();
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
              <b className={styles.identifier}>
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
            {isSubmitting ? t("common.processing") : t("common.yes")}
          </button>
          <button 
            className={styles.cancelButton} 
            onClick={onRequestClose}
            disabled={isSubmitting}
          >
            {t("common.no")}
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