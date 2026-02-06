// src/components/Modals/HolidayDetailModal.tsx
import React from 'react';
import { Modal, Button, Spin } from 'antd';
import dayjs from 'dayjs';

interface HolidayRequest {
  id: number;
  name: string;
  date: string;
  type: string;
  base: string;
  status: 'Pending' | 'Approved' | 'Declined';
}

interface Props {
  visible: boolean;
  holiday: HolidayRequest | null;
  onClose: () => void;
  onApprove: () => void;
  onDecline: () => void;
}

const HolidayDetailModal: React.FC<Props> = ({
  visible,
  holiday,
  onClose,
  onApprove,
  onDecline,
}) => {
  return (
    <Modal
      title="Holiday Detail"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="decline" onClick={onDecline}>
          Decline
        </Button>,
        <Button key="approve" type="primary" onClick={onApprove}>
          Approve
        </Button>,
      ]}
      width={600}
      getContainer={false}
    >
      {holiday ? (
        <div className="holiday-detail">
          <div className="holiday-field">
            <label>Holiday Name</label>
            <input value={holiday.name} disabled />
          </div>
          <div className="holiday-field">
            <label>Date</label>
            <input value={dayjs(holiday.date).format('MMM DD, YYYY')} disabled />
          </div>
          <div className="holiday-field">
            <label>Type</label>
            <input value={holiday.type} disabled />
          </div>
          <div className="holiday-field">
            <label>Base</label>
            <input value={holiday.base} disabled />
          </div>
          <div className="holiday-field">
            <label>Status</label>
            <input value={holiday.status} disabled />
          </div>
        </div>
      ) : (
        <Spin tip="Loading..." />
      )}
    </Modal>
  );
};

export default HolidayDetailModal;
