import React, { useState } from "react";
import { Modal, Button, message } from "antd";
import api from "api/axios";

interface Props {
  open: boolean;
  username: string;
  userId?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const ForgotPasswordModal: React.FC<Props> = ({ open, username, userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!userId) return;

    setLoading(true);
    try {
        await api.post(`/employees/users/${userId}/reset-password/`);
        message.success(`Password reset successfully for ${username}.`);
        onSuccess();
    } catch (error: any) {
        console.error(error);
        message.error(error.response?.data?.detail || "Failed to reset password");
    } finally {
        setLoading(false);
    }
    };


  return (
    <Modal
      open={open}
      title={`Reset Password for ${username}`}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          onClick={handleResetPassword}
        >
          Yes, Proceed
        </Button>,
      ]}
      destroyOnClose
    >
      <p>Are you sure you want to reset the password for <strong>{username}</strong>? The new password will be generated automatically and emailed to the user.</p>
    </Modal>
  );
};

export default ForgotPasswordModal;
