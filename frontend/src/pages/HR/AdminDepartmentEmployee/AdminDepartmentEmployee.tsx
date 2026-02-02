import React, { useEffect, useState } from "react";
import { Layout, Table, Input, Button, message } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Admin_DepartmentEmployee.module.css";
import AddAddDeptEmployee from "./AddAdDeptEmployee";

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

  const fetchEmployees = async () => {
    if (!deptId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/employees/employees/by-department/${deptId}/`
      );
      if (!res.ok) throw new Error("Failed to fetch employees");
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load employees");
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
    { title: "Department", dataIndex: "department", key: "department" },
    { title: "Shift", dataIndex: "shift", key: "shift" },
    { title: "Hired Date", dataIndex: "hired_date", key: "hired_date" },
  ];

  return (
    <Layout className={styles.layout} style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Employees" showBack />

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

          <AddAddDeptEmployee
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
