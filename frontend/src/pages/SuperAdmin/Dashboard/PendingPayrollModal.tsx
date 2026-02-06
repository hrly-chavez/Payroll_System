// src/components/Modals/PendingPayrollModal.tsx
import React from 'react';
import { Modal, Table, Button, Spin } from 'antd';
import dayjs from 'dayjs';

interface Payroll {
  id: number;
  employee_name: string;
  period: string;
  total_amount: number;
  status: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  data: Payroll[];
  loading: boolean;
  navigateToAll: () => void;
}

const PendingPayrollModal: React.FC<Props> = ({ visible, onClose, data, loading, navigateToAll }) => {
  const payrollColumns = [
    { title: 'Employee', dataIndex: 'employee_name', key: 'employee_name' },
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      render: (period: string) => dayjs(period).format('MMM DD, YYYY'),
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => `₱${amount.toLocaleString()}`,
    },
    { title: 'Status', dataIndex: 'status', key: 'status' },
  ];

  return (
    <Modal
      title="Pending Payroll(s)"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="see-all" type="link" onClick={navigateToAll}>
          See All
        </Button>,
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      width={800}
    >
      <Table
        columns={payrollColumns}
        dataSource={data}
        loading={loading}
        pagination={false}
        rowKey="id"
      />
    </Modal>
  );
};

export default PendingPayrollModal;
