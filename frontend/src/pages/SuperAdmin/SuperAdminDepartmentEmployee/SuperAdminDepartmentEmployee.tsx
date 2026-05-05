import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Layout, Table, Input, Button, message, Select } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AddEmployeeFlow from "../../HR/AdminDepartmentEmployee/AddEmployee/AddEmployeeFlow";
import styles from "../../HR/AdminDepartmentEmployee/Admin_DepartmentEmployee.module.css";
import api from "../../../api/axios";

interface EmployeeType {
  id: number;
  name: string;
  manager: string;
  position: string;
  status: string;
  department: string;
  shift: string;
  hired_date: string;
  is_active: boolean;
}

const SuperAdminDepartmentEmployee: React.FC = () => {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  //employee status (deactivated or active)
  const [statusFilter, setStatusFilter] = useState("active");

  const deptName =
    (location.state as { deptName?: string })?.deptName || "Employees";

  const fetchEmployees = async () => {
    if (!deptId) return;

    setLoading(true);
    try {
      const res = await api.get(
        `/employees/employees/by-department/${deptId}/`,
        {
          params: { status: statusFilter }, // key line
        }
      );
      setEmployees(res.data);
    } catch (err: any) {
      console.error(err);
      message.error(
        err.response?.data?.message || "Failed to load employees"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [deptId, statusFilter]);

  const filteredEmployees = [...employees]
    .filter((emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      //  Step 1: Active first
      if (a.is_active !== b.is_active) {
        return a.is_active ? -1 : 1;
      }

      //  Step 2: Then sort by hired date (latest first)
      return (
        new Date(b.hired_date).getTime() -
        new Date(a.hired_date).getTime()
      );
    });

  const columns: TableProps<EmployeeType>["columns"] = [
    {
      title: "Employee Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <span className={styles.empLink}>{text}</span>,
    },
    { title: "Position", dataIndex: "position", key: "position" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Shift", dataIndex: "shift_info", key: "shift" },
    { title: "Hired Date", dataIndex: "hired_date", key: "hired_date" },
    {
      title: "Account Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (is_active: boolean) => (
        <span
          style={{
            color: is_active ? "#52c41a" : "#ff4d4f",
            fontWeight: 600,
          }}
        >
          {is_active ? "Active" : "Deactivated"}
        </span>
      ),
    },
  ];

  return (
    <Layout className={styles.layout} style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title={deptName} showBack />

        <Layout.Content className={styles.content}>
          <div className={styles.topBar}>
            <div className={styles.leftControls}>
              <Input
                placeholder="Search"
                prefix={<SearchOutlined />}
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value)}
                style={{ width: 180 }}
              >
                <Select.Option value="active">Active Employees</Select.Option>
                <Select.Option value="inactive">Deactivated Employees</Select.Option>
                <Select.Option value="all">All Employees</Select.Option>
              </Select>
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              className={styles.addBtn}
              onClick={() => setOpen(true)}
            >
              Add Employee
            </Button>
          </div>

          <Table<EmployeeType>
            columns={columns}
            dataSource={filteredEmployees}
            rowKey="id"
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "50"],
              showTotal: (total) => `Total ${total} employees`,
            }}
            className={styles.table}
            onRow={(record) => ({
              onClick: () =>
                navigate(
                  `/super-admin/department/employee/employee-details/${record.id}`
                ),
              style: { cursor: "pointer" },
            })}
          />

          {deptId && (
            <AddEmployeeFlow
              open={open}
              departmentId={Number(deptId)}
              allowedRoles={["SUPER_ADMIN", "ADMIN"]}
              onClose={() => {
                setOpen(false);
                fetchEmployees();
              }}
            />
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default SuperAdminDepartmentEmployee;
