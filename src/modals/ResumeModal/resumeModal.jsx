import { motion } from "framer-motion";
import styles from "./resumeModal.module.scss";
import PropTypes from "prop-types";
import { useT } from "../../i18n/useT";

const ResumeModal = ({
  isOpen,
  selectedExpense,
  onConfirm,
  onRequestClose,
}) => {
  const t = useT();
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
        <h2>{t("modal.resume.title")}</h2>
        <p className={styles.message}>
          {t("modal.resume.message")}
          <b className={styles.identifier}>
            {` `}&rdquo;{selectedExpense?.name}&rdquo;
          </b>
          ?
        </p>
        <div className={styles.buttons}>
          <button className={styles.confirmButton} onClick={onConfirm}>
            {t("common.confirm")}
          </button>
          <button className={styles.cancelButton} onClick={onRequestClose}>
            {t("common.cancel")}
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
