import React from "react";
import Modal from "react-modal";
import styles from "./styles.module.scss";

const ConfirmationModal = ({ isOpen, onRequestClose, onConfirmDelete }) => {
  return (
    <Modal
      className={styles.modal}
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Confirm Delete"
    >
      <h2>Confirm Delete</h2>
      <p>Are you sure you want to delete this expense?</p>
      <div className={styles.buttons}>
          <button className={styles.confirmButton} onClick={onConfirmDelete}>Yes</button>
          <button className={styles.cancelButton} onClick={onRequestClose}>No</button>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
