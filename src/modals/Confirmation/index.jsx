import { motion } from "framer-motion";
import styles from "./styles.module.scss";
import PropTypes from "prop-types";

const ConfirmationModal = ({
  isOpen,
  onRequestClose,
  onConfirmDelete,
  expenseName,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onRequestClose}></div>
      <motion.div
        className={styles.modal}
        initial={{ scale: 0.1, opacity: 0 }} // Começa super pequeno e invisível
        animate={{ scale: 1, opacity: 1 }} // Cresce até o tamanho normal e fica visível
        exit={{ scale: 0.1 }} // Encolhe novamente ao sair
        transition={{ duration: 0.3, ease: "linear" }}
      >
        <h2>Confirm Delete</h2>
        <p className={styles.message}>
          Are you sure you want to delete the expense &rdquo;
          <b>{expenseName}</b>
          &rdquo;?
        </p>
        <div className={styles.buttons}>
          <button className={styles.confirmButton} onClick={onConfirmDelete}>
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
  onConfirmDelete: PropTypes.func.isRequired,
  expenseName: PropTypes.string.isRequired,
};

export default ConfirmationModal;
