//src/pages/SuperAdmin/Dashboard/ExcessTimeModal.tsx
import React from "react";
import { Modal, Table, Button } from "antd";
import type { ExcessTimeRequest } from "./types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onRowClick: (row: ExcessTimeRequest) => void;
  data: ExcessTimeRequest[];
  loading: boolean;
  navigateToAll: () => void;
}

const ExcessTimeModal: React.FC<Props> = ({
  visible,
  onClose,
  onRowClick,
  data,
  loading,
  navigateToAll,
}) => {
  const columns = [{ title: "Employee", dataIndex: "name", key: "name" }];

  return (
    <Modal
      title="Excess Time Pending(s)"
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
      width={600}
    >
      <Table
        columns={columns}
        dataSource={data.filter((r) => r.status === "Pending")}
        loading={loading}
        pagination={false}
        rowKey="id"
        onRow={(record) => ({
          onClick: () => onRowClick(record),
          style: { cursor: "pointer" },
        })}
      />
    </Modal>
  );
};

export default ExcessTimeModal;