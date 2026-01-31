import React, { useState } from "react";
import { Layout, Table, Input, Button } from "antd";
import type { TableProps } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Department.module.css";
import AddDepartment from "./AddDepartment";

interface DataType {
  key: string;
  deptname: string;
  description: string;
  workshift: string;
  ManagerName: string;
}

const data: DataType[] = [
  {
    key: "1",
    deptname: "Agents Department",
    description:
      "Acts as the frontline support and communication hub, immediately managing high volumes of incoming and outgoing calls.",
    workshift: "Night | 12:00 a.m - 9:00 a.m",
    ManagerName: "Melichenko Alexandr",
  },
  {
    key: "2",
    deptname: "Finance Department",
    description:
      "Acts as the engine of operational stability, focusing on maintaining liquidity and processing transactions.",
    workshift: "Morning | 9:00 a.m - 6:00 p.m",
    ManagerName: "Shurenkova Larisa",
  },
  {
    key: "3",
    deptname: "IT Department",
    description:
      "Acts as the engine of operational stability, focusing on maintaining liquidity and processing transactions.",
    workshift: "Morning | 9:00 a.m - 6:00 p.m",
    ManagerName: "Shurenkova Larisa",
  },
];

const Department: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const columns: TableProps<DataType>["columns"] = [
    {
      title: "Department",
      dataIndex: "deptname",
      key: "deptname",
      width: 200,
      render: (text) => (
        <a onClick={() => navigate(`/admin/department-employee`)}>
          {text}
        </a>
      ),
      render: (text) => <span className={styles.rowLink}>{text}</span>,
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      responsive: ["md"], // hides on mobile
    },
    {
      title: "Workshift",
      dataIndex: "workshift",
      key: "workshift",
      width: 220,
    },
    {
      title: "Manager",
      dataIndex: "ManagerName",
      key: "ManagerName",
      width: 220,
      responsive: ["lg"], // hides on small screens
    },
  ];

  return (
    <Layout className={styles.layout}>
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

          <Table<DataType>
            columns={columns}
            dataSource={data}
            pagination={false}
            className={styles.table}
            onRow={(record) => ({
              onClick: () => navigate(`/admin/department-employee/${record.key}`),
              style: { cursor: "pointer" },
            })}
          />

          <AddDepartment open={open} onClose={() => setOpen(false)} />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default Department;
