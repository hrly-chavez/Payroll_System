import React, { useEffect, useState } from "react";
import { Layout, Table, Input, Button, message, Tooltip, Switch, Tag } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AddDepartment, { DepartmentType } from "../../HR/Department/AddDepartment";
import styles from "../../HR/Department/Department.module.css";
import api from "../../../api/axios";

const Department: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingDept, setEditingDept] = useState<DepartmentType | null>(null);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/employees/departments/");
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (dept: DepartmentType) => {
    try {
      await api.patch(`/employees/departments/${dept.id}/`, {
        is_active: !dept.is_active,
      });
      message.success(`${dept.name} is now ${!dept.is_active ? "active" : "inactive"}`);
      fetchDepartments();
    } catch (err) {
      console.error(err);
      message.error("Failed to update status");
    }
  };

  const columns: TableProps<DepartmentType>["columns"] = [
    { title: "ID", dataIndex: "id", key: "id", width: 80 },
    {
      title: "Department",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name), // alphabetical sort
      sortDirections: ["ascend", "descend"],
      render: (text) => (
        <span className={styles.rowLink}>{text}</span>
      ),
    },
    {
      title: "Workshift",
      dataIndex: "shift",
      key: "shift",
      render: (shift) => {
        if (!shift) return "—";
        if (typeof shift === "object") return `${shift.start_time} - ${shift.end_time}`;
        return shift;
      },
    },
    {
      title: "Holiday Base",
      dataIndex: "holiday_base",
      key: "holiday_base",
      render: (bases: string[]) => {
        if (!bases || bases.length === 0) return "—";
        return bases.map((base) => (
          <Tag key={base}>{base}</Tag>
        ));
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Tooltip title="Edit">
            <Button
              type="default"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setEditingDept(record);
                setOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? "Deactivate" : "Activate"}>
            <Switch
              checked={record.is_active}
              onClick={(checked, e) => {
                e.stopPropagation();
                handleToggleActive(record);
              }}
            />
          </Tooltip>
        </div>
      ),
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
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              className={styles.addBtn}
              onClick={() => {
                setEditingDept(null);
                setOpen(true);
              }}
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
            onRow={(record) => ({
              onClick: () =>
                navigate(`/super-admin/department-employee/${record.id}`, {
                  state: { deptName: record.name },
                }),
              style: { cursor: "pointer" },
            })}
          />

          <AddDepartment
            open={open}
            onClose={() => {
              setOpen(false);
              fetchDepartments();
              setEditingDept(null);
            }}
            initialValues={editingDept || undefined}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default Department;
