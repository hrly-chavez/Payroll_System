import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Layout, Table, Input, Button, message } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Admin_DepartmentEmployee.module.css";
// import AddAddDeptEmployee from "./AddAdDeptEmployee";
import AddEmployeeFlow from "./AddEmployee/AddEmployeeFlow";
import api from "api/axios";

interface EmployeeType {
  id: number;
  name: string;
  manager: string;
  position: string;
  status: string;
  department: string;
  shift: string;
  hired_date: string;
}

const AdminDepartmentEmployee: React.FC = () => {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const location = useLocation();
  const deptName = (location.state as { deptName?: string })?.deptName || "Employees";

  const fetchEmployees = async () => {
    if (!deptId) return;

    setLoading(true);
    try {
      const res = await api.get(`/employees/employees/by-department/${deptId}/`);
      setEmployees(res.data); // axios already parses JSON
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [deptId]);

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: TableProps<EmployeeType>["columns"] = [
    {
      title: "Employee Name",
      dataIndex: "name",
      key: "name",
      render: (text) => (
        <span className={styles.empLink}>{text}</span>
      ),
    },
    { title: "Position", dataIndex: "position", key: "position" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Shift", dataIndex: "shift_info", key: "shift" },
    { title: "Hired Date", dataIndex: "hired_date", key: "hired_date" },
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
              <Button icon={<SlidersOutlined />} className={styles.filterBtn}>
                Filter
              </Button>
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
            pagination={false}
            className={styles.table}
            onRow={(record) => ({
              onClick: () =>
                navigate(
                  `/admin/employee/employee-details/${record.id}`
                ),
              style: { cursor: "pointer" },
            })}
          />

          <AddEmployeeFlow
            open={open}
            onClose={() => {
              setOpen(false);
              fetchEmployees();
            }}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default AdminDepartmentEmployee;
