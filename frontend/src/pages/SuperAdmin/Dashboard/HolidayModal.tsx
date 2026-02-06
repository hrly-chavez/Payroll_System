// src/components/Modals/HolidayModal.tsx
import React from 'react';
import { Modal, Table, Button, Spin } from 'antd';
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
  onClose: () => void;
  onRowClick: (holiday: HolidayRequest) => void;
  data: HolidayRequest[];
  loading: boolean;
  navigateToAll: () => void;
}

const HolidayModal: React.FC<Props> = ({
  visible,
  onClose,
  onRowClick,
  data,
  loading,
  navigateToAll,
}) => {
  const holidayColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Base', dataIndex: 'base', key: 'base' },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: HolidayRequest) => (
        <Button
          disabled
          style={{
            backgroundColor:
              record.status === 'Approved'
                ? '#d4edda'
                : record.status === 'Declined'
                ? '#f8d7da'
                : '#fff',
            color:
              record.status === 'Approved'
                ? '#155724'
                : record.status === 'Declined'
                ? '#721c24'
                : '#000',
            cursor: 'default',
          }}
        >
          {record.status}
        </Button>
      ),
    },
  ];

  return (
    <Modal
      title="Holiday Request(s)"
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
        columns={holidayColumns}
        dataSource={data.filter(h => h.status === 'Pending')}
        loading={loading}
        pagination={false}
        rowKey="id"
        onRow={record => ({
          onClick: () => onRowClick(record),
          style: { cursor: 'pointer' },
        })}
      />
    </Modal>
  );
};

export default HolidayModal;
