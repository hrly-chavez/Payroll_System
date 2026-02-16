import React, { useState } from "react";
import { Table, Button } from "antd";
import EditEmployeeAllowanceModal from "../Modals/EditEmployeeAllowanceModal";

interface Allowance {
  id: number;
  allowance_type_id: number;
  name: string;
  amount: string;
  frequency: string;
  status: string;
  effective_from: string;
}

interface Props {
  employeeId: number;
  allowances: Allowance[];
  loading: boolean;
  onSuccess: () => void; // refresh callback
}

const AllowanceTab: React.FC<Props> = ({
  employeeId,
  allowances,
  loading,
  onSuccess,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAllowance, setSelectedAllowance] =
    useState<Allowance | undefined>(undefined);

  const openEditModal = (record: Allowance) => {
    setSelectedAllowance(record);
    setIsModalOpen(true);
  };

  const columns = [
    { title: "Allowance Name", dataIndex: "name", key: "name" },
    { title: "Amount", dataIndex: "amount", key: "amount" },
    { title: "Frequency", dataIndex: "frequency", key: "frequency" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Effective from", dataIndex: "effective_from", key: "effective_from" },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: Allowance) => (
        <Button type="link" onClick={() => openEditModal(record)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table
        columns={columns}
        dataSource={allowances}
        loading={loading}
        pagination={false}
      />

      <EditEmployeeAllowanceModal
        open={isModalOpen}
        allowance={selectedAllowance}
        employeeId={employeeId}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAllowance(undefined);
        }}
        onSuccess={() => {
          setIsModalOpen(false);
          setSelectedAllowance(undefined);
          onSuccess(); // tell parent to refresh
        }}
      />
    </>
  );
};

export default AllowanceTab;