import React, { useEffect, useState } from "react";
import { Layout, Table, Input, Button, message, Select } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import AddDepartment from "./AddDepartment";
import styles from "./Department.module.css";
import api from "../../../api/axios";

interface ShiftType {
  id: number;
  start_time: string;
  end_time: string;
}

interface DepartmentType {
  id: number;
  name: string;
  shift: ShiftType | number;
  holiday_base: string;
}

const Department: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [holidayFilter, setHolidayFilter] = useState<string | null>(null);

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

  // Combined filtering (search + holiday)
  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch = dept.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesHoliday =
      !holidayFilter || dept.holiday_base === holidayFilter;

    return matchesSearch && matchesHoliday;
  });

  const columns: TableProps<DepartmentType>["columns"] = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
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
        if (typeof shift === "object") {
          return `${shift.start_time} - ${shift.end_time}`;
        }
        return shift;
      },
    },
    {
      title: "Holiday Base",
      dataIndex: "holiday_base",
      key: "holiday_base",
      sorter: (a, b) =>
        (a.holiday_base || "").localeCompare(b.holiday_base || ""),
      sortDirections: ["ascend", "descend"],
      render: (value) => (value ? value : "—"),
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

              {/* Holiday Base Filter Dropdown */}
              <Select
                placeholder="Holiday Base"
                allowClear
                style={{ width: 160 }}
                value={holidayFilter || undefined}
                onChange={(value) => setHolidayFilter(value)}
                options={Array.from(
                  new Set(departments.map((d) => d.holiday_base))
                ).map((value) => ({
                  label: value,
                  value,
                }))}
              />
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
            onRow={(record) => ({
              onClick: () =>
                navigate(`/admin/department-employee/${record.id}`, {
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
            }}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default Department;
