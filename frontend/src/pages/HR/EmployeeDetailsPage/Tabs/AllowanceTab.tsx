import React, { useEffect, useState } from "react";
import { Table, Button, message } from "antd";
import api from "api/axios";
import EditEmployeeAllowanceModal from "../Modals/EditEmployeeAllowanceModal";
import AddEmployeeAllowanceModal from "../Modals/AddEmployeeAllowanceModal";


interface Allowance {
  key: number;
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
}

const AllowanceTab: React.FC<Props> = ({ employeeId }) => {
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [loading, setLoading] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAllowance, setSelectedAllowance] =
    useState<Allowance | undefined>(undefined);

  /* =========================
     FETCH ALLOWANCES
  ========================== */
  const fetchAllowances = async () => {
    if (!employeeId) return;

    setLoading(true);
    try {
      const response = await api.get("/employees/allowances/", {
        params: { employee: employeeId },
      });

      const tableData = response.data.map((item: any) => ({
        key: item.id,
        id: item.id,
        allowance_type_id: item.allowance_type.id,
        name: item.allowance_type.name,
        amount: `₱${Number(item.amount).toLocaleString()}`,
        frequency: item.frequency,
        status: item.status,
        effective_from: item.effective_from,
      }));

      setAllowances(tableData);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch allowances");
      setAllowances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllowances();
  }, [employeeId]);

  const openEditModal = (record: Allowance) => {
    setSelectedAllowance(record);
    setIsModalOpen(true);
  };

  const columns = [
    { title: "Allowance Name", dataIndex: "name", key: "name" },
    { title: "Amount", dataIndex: "amount", key: "amount" },
    { title: "Frequency", dataIndex: "frequency", key: "frequency" },
    { title: "Status", dataIndex: "status", key: "status" },
    {
      title: "Effective from",
      dataIndex: "effective_from",
      key: "effective_from",
    },
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
      <div style={{ marginBottom: 16, textAlign: "right" }}>
        <Button type="primary" onClick={() => setIsAddModalOpen(true)}>
          Add Allowance
        </Button>
      </div>
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
          fetchAllowances(); // refresh inside tab
        }}
      />

      {/* ADD MODAL */}
      <AddEmployeeAllowanceModal
        open={isAddModalOpen}
        employeeId={employeeId}
        existingAllowances={allowances}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchAllowances();
        }}
      />
    </>
  );
};

export default AllowanceTab;
