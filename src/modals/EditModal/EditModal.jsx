import React, { useState } from "react";
import PropTypes from "prop-types";
import styles from "./EditModal.module.scss";
import { FaSpinner } from "react-icons/fa";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

const EditModal = ({
  isOpen,
  onRequestClose,
  onConfirm,
  editingExpense,
  editFormData,
  setEditFormData,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onConfirm(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "inclusionDate" && editFormData.pauseDate) {
      const inclusionDate = new Date(value);
      const pauseDate = new Date(editFormData.pauseDate);
      
      if (inclusionDate >= pauseDate) {
        toast.error("Inclusion date must be before pause date");
        return;
      }
    }
    
    if (name === "pauseDate") {
      const inclusionDate = new Date(editFormData.inclusionDate);
      const newPauseDate = new Date(value);
      
      if (newPauseDate <= inclusionDate) {
        toast.error("Pause date must be after inclusion date");
        return;
      }
    }
    
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={onRequestClose} />
      <motion.div
        className={styles.modalContent}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h2>Edit Expense</h2>
        <form onSubmit={handleSubmit} className={styles.editForm}>
          <div className={styles.editFormContainer}>
            <div className={styles.formGroup}>
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={editFormData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="value">Value:</label>
              <input
                type="number"
                id="value"
                name="value"
                value={editFormData.value}
                onChange={handleInputChange}
                required
                step="0.01"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="inclusionDate">Inclusion Date:</label>
              <input
                type="date"
                id="inclusionDate"
                name="inclusionDate"
                value={editFormData.inclusionDate}
                onChange={handleInputChange}
                max={editFormData.pauseDate ? new Date(new Date(editFormData.pauseDate).getTime() - 86400000).toISOString().split('T')[0] : undefined}
                required
              />
            </div>

            {editingExpense?.isMonthly && (
              <div className={styles.formGroup}>
                <label htmlFor="pauseDate">Pause Date:</label>
                <input
                  type="date"
                  id="pauseDate"
                  name="pauseDate"
                  value={editFormData.pauseDate}
                  onChange={handleInputChange}
                  min={new Date(new Date(editFormData.inclusionDate).getTime() + 86400000).toISOString().split('T')[0]}
                />
              </div>
            )}

            {!editingExpense?.isMonthly && (
              <div className={styles.formGroup}>
                <label htmlFor="installments">Installments:</label>
                <input
                  type="number"
                  id="installments"
                  name="installments"
                  value={editFormData.installments}
                  onChange={handleInputChange}
                  min="1"
                  required
                />
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="paymentMethod">Payment Method:</label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={editFormData.paymentMethod}
                onChange={handleInputChange}
                required
              >
                <option value="Money">Money</option>
                <option value="Pix">Pix</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
              </select>
            </div>
          </div>

          <div className={styles.modalButtons}>
            <button type="submit" className={styles.confirmButton}>Edit</button>
            <button type="button" onClick={onRequestClose} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </form>
      </motion.div>

      {isLoading && (
        <div className={styles.loadingModal}>
          <div className={styles.loadingContent}>
            <FaSpinner className={styles.spinner} />
            <p>Saving changes...</p>
          </div>
        </div>
      )}
    </>
  );
};

EditModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onRequestClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  editingExpense: PropTypes.object,
  editFormData: PropTypes.object.isRequired,
  setEditFormData: PropTypes.func.isRequired,
};

export default EditModal; 