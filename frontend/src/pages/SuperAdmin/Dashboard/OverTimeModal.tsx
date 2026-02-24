//src/pages/SuperAdmin/Dashboard/OverTimeModal.tsx
import React from "react";
import { Modal, Table, Button } from "antd";
import type { OverTimeRequest } from "./types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onRowClick: (row: OverTimeRequest) => void;
  data: OverTimeRequest[];
  loading: boolean;
  navigateToAll: () => void;
}

const OverTimeModal: React.FC<Props> = ({
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
      title="OverTime Pending(s)"
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

export default OverTimeModal;