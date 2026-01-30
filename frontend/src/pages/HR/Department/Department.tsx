import React from "react";
import { Layout, Table, Input, Button } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import Sidebar from "../../../components/Sidebar/Sidebar";
import styles from "./Department.module.css";

interface DataType {
  key: string;
  deptname: string;
  description: string;
  workshift: string;
  ManagerName: string;
}

const columns: TableProps<DataType>["columns"] = [
  { title: "Department", dataIndex: "deptname", key: "deptname" },
  { title: "Description", dataIndex: "description", key: "description" },
  { title: "Workshift", dataIndex: "workshift", key: "workshift" },
  { title: "Manager", dataIndex: "ManagerName", key: "ManagerName" },
];

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
  return (
    <Layout className={styles.layout}>
      <Sidebar />

      <Layout.Content className={styles.content}>
        <div className={styles.topBar}>
          {/* LEFT SIDE CONTROLS */}
          <div className={styles.leftControls}>
            <Input
              placeholder="Search"
              prefix={<SearchOutlined />}
              className={styles.searchInput}
            />

            <Button
              icon={<SlidersOutlined />}
              className={styles.filterBtn}
            >
              Filter
            </Button>
          </div>

          {/* RIGHT SIDE BUTTON */}
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className={styles.addBtn}
          >
            Add Department
          </Button>
        </div>

        <Table<DataType>
          columns={columns}
          dataSource={data}
          pagination={false}
          className={styles.table}
        />
      </Layout.Content>
    </Layout>
  );
};

export default Department;
