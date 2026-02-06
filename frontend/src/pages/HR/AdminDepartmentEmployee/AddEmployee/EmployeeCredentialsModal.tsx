import React, { useEffect, useState } from "react";
import { Modal, Input, Button, message } from "antd";
import api from "api/axios";

interface Props {
  open: boolean;
  credentials: { username: string; password: string };
  onNext: () => void;
  onClose: () => void;
}

const EmployeeCredentialsModal: React.FC<Props> = ({
  open,
  credentials,
  onNext,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      title="Employee Credentials"
      onCancel={onClose}
      closable={false}
      footer={[
        <Button key="next" type="primary" onClick={onNext}>
          Next
        </Button>,
      ]}
    >
      <p>Please save these credentials. They will not be shown again.</p>

      <Input
        style={{ marginBottom: 12 }}
        value={credentials.username}
        readOnly
        addonBefore="Username"
      />

      <Input.Password
        value={credentials.password}
        readOnly
        addonBefore="Password"
      />
    </Modal>
  );
};


export default EmployeeCredentialsModal;
