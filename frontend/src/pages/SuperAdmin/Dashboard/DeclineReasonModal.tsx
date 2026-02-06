// src/components/Modals/DeclineReasonModal.tsx
import React from 'react';
import { Modal, Button } from 'antd';

interface Props {
  visible: boolean;
  reason: string;
  setReason: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const DeclineReasonModal: React.FC<Props> = ({ visible, reason, setReason, onCancel, onSave }) => {
  return (
    <Modal
      title="Reason for Declining"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="save" type="primary" onClick={onSave}>
          Save
        </Button>,
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
      ]}
    >
      <textarea
        placeholder="Enter reason for declining"
        value={reason}
        onChange={e => setReason(e.target.value)}
        style={{ width: '100%', minHeight: 100 }}
      />
    </Modal>
  );
};

export default DeclineReasonModal;
