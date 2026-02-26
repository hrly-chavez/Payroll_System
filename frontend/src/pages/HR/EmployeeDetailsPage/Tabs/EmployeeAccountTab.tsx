import React, { useEffect, useState } from "react";
import { Table, Button, message, Spin } from "antd";
import api from "api/axios";
import ForgotPasswordModal from "../Modals/ForgotPasswordModal";
import DeactivateUserModal from "../Modals/DeactivateUserModal";

interface Props {
  employeeId: number;
}

const EmployeeAccountTab: React.FC<Props> = ({ employeeId }) => {
  const [userAccount, setUserAccount] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);

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
          danger={userAccount.is_active}
          onClick={() => setIsDeactivateModalOpen(true)}
        >
          {userAccount.is_active ? "Deactivate" : "Reactivate"}
        </Button>

        <Button
          style={{ marginLeft: 8 }}
          onClick={() => setIsForgotPasswordOpen(true)}
        >
          Reset Password
        </Button>
      </div>

      <Table columns={columns} dataSource={[userAccount]} pagination={false} />

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

      {userAccount && (
        <DeactivateUserModal
          open={isDeactivateModalOpen}
          userId={userAccount.user_id}
          username={userAccount.user_name}
          isActive={userAccount.is_active}
          onClose={() => setIsDeactivateModalOpen(false)}
          onSuccess={fetchUserAccount}
        />
      )}
    </>
  );
};

export default EmployeeAccountTab;