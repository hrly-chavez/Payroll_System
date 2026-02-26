import React, { useEffect, useState } from "react";
import { Table, Button, Modal, message, Spin } from "antd";
import api from "api/axios";
import ForgotPasswordModal from "../Modals/ForgotPasswordModal"; // make sure path is correct

interface Props {
  employeeId: number;
}

const EmployeeAccountTab: React.FC<Props> = ({ employeeId }) => {
  const [userAccount, setUserAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

  const fetchUserAccount = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/employees/users/employee/${employeeId}/`);
      setUserAccount(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch user account");
      setUserAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAccount();
  }, [employeeId]);

  const handleToggle = () => {
    if (!userAccount) return;

    Modal.confirm({
      title: `Are you sure you want to ${
        userAccount.is_active ? "deactivate" : "activate"
      } this user?`,
      onOk: async () => {
        try {
          const res = await api.post(
            `/employees/users/${userAccount.user_id}/deactivate/`
          );
          message.success(res.data.detail);
          fetchUserAccount(); // refresh after toggle
        } catch (err: any) {
          console.error(err);
          message.error(err.response?.data?.detail || "Failed to update status");
        }
      },
    });
  };

  if (loading) return <Spin tip="Loading user account..." />;

  if (!userAccount) return <p>No user account linked to this employee.</p>;

  const columns = [
    { title: "Username", dataIndex: "user_name", key: "user_name" },
    { title: "Role", dataIndex: "role", key: "role" },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (val: boolean) => (val ? "Active" : "Inactive"),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          danger
          onClick={handleToggle}
        >
          {userAccount.is_active ? "Deactivate" : "Activate"}
        </Button>

        <Button
          style={{ marginLeft: 8 }}
          onClick={() => setIsForgotPasswordOpen(true)}
        >
          Reset Password
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={[userAccount]} 
        pagination={false} 
        scroll={{ x: "max-content" }}
      />

      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        username={userAccount.user_name}
        userId={userAccount.user_id}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccess={() => {
          setIsForgotPasswordOpen(false);
          fetchUserAccount();
        }}
      />
    </>
  );
};

export default EmployeeAccountTab;