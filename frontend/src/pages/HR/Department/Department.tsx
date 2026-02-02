import React, { useEffect, useState } from "react";
import { Layout, Table, Input, Button, message } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AddDepartment from "./AddDepartment";
import styles from "./Department.module.css";

interface DepartmentType {
  id: number;
  name: string;
  shift: number | { id: number; start_time: string; end_time: string };
}

const Department: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Fetch departments from backend
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/employees/departments/");
      if (!res.ok) throw new Error("Failed to fetch departments");
      const data = await res.json();
      setDepartments(data);
    } catch (error) {
      console.error(error);
      message.error("Error fetching departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Filtered departments by search
  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns: TableProps<DepartmentType>["columns"] = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "Department Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <a onClick={() => navigate(`/admin/department-employee`)}>
          {text}
        </a>
      ),
    },
    {
      title: "Shift",
      dataIndex: "shift",
      key: "shift",
      render: (shift) => {
        // Handle if shift is just an ID or full object
        if (typeof shift === "object") {
          return `${shift.start_time} - ${shift.end_time}`;
        }
        return shift; // fallback ID
      },
    },
  ];

  return (
    <Layout className={styles.layout} style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Department" />
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
              Add Department
            </Button>
          </div>

          <Table<DepartmentType>
            columns={columns}
            dataSource={filteredDepartments}
            rowKey="id"
            loading={loading}
            pagination={false}
            className={styles.table}
            scroll={{ x: "max-content" }}
          />

          <AddDepartment
            open={open}
            onClose={() => {
              setOpen(false);
              fetchDepartments(); // refresh table after adding
            }}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default Department;
