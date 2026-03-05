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
    setSelectedSalary(undefined); // always fresh form
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

  // Determine button label dynamically
  const hasSalary = salaries.length > 0;
  const buttonLabel = hasSalary ? "Update Base Salary" : "Add Base Salary";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>Base Salary</h3>
        <Button type="primary" onClick={openModal}>
          {buttonLabel}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={salaries}
        loading={loading}
        pagination={false}
        scroll={{ x: "max-content" }}
        rowKey="id"
      />

      <EditEmployeeSalaryModal
        open={isModalOpen}
        employeeId={employeeId}
        salary={selectedSalary} // always undefined here so modal opens as a fresh form
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          onSuccess(); // refresh salaries & deductions in parent
        }}
      />
    </>
  );
};

export default BaseSalaryTab;