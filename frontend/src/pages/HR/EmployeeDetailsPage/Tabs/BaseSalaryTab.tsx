import React, { useState } from "react";
import { Table, Button, message } from "antd";
import EditEmployeeSalaryModal from "../Modals/EditEmployeeSalaryModal";

interface Salary {
  id: number;
  base_rate: number;
  pay_type: string;
  effective_from: string;
}

interface Props {
  employeeId: number;
  salaries: Salary[];
  loading: boolean;
  onSuccess: () => void; // refresh callback
}

const BaseSalaryTab: React.FC<Props> = ({
  employeeId,
  salaries,
  loading,
  onSuccess,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<Salary | undefined>(undefined);

  const openModal = () => {
    setSelectedSalary(undefined); // Always open as fresh form
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: "Salary Amount",
      dataIndex: "base_rate",
      key: "base_rate",
      render: (val: number) => `₱${val.toLocaleString()}`,
    },
    {
      title: "Salary Type",
      dataIndex: "pay_type",
      key: "pay_type",
    },
    {
      title: "Effective From",
      dataIndex: "effective_from",
      key: "effective_from",
    },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>Base Salary</h3>
        <Button type="primary" onClick={openModal}>
        Update Base Salary
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={salaries}
        loading={loading}
        pagination={false}
        scroll={{ x: "max-content" }}
      />

      <EditEmployeeSalaryModal
        open={isModalOpen}
        employeeId={employeeId}
        salary={selectedSalary}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          onSuccess(); // tell parent to refresh salaries & deductions
        }}
      />
    </>
  );
};

export default BaseSalaryTab;