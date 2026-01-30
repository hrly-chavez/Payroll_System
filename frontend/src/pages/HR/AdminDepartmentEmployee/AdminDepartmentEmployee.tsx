import React from "react";
import { Layout, Table, Input, Button } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import Sidebar from "../../../components/Sidebar/Sidebar";
import styles from "./Admin_DepartmentEmployee.module.css";  
import { useState } from "react";
import AddAddDeptEmployee from "./AddAdDeptEmployee";


interface DataType {
  key: string;
  empname: string;
  manager: string;
  position: string;
  status: string;
  deptname: string;
  shift: number;
  hireddate: string;

}

const columns: TableProps<DataType>["columns"] = [
  { title: "Employee Name", dataIndex: "empname", key: "empname" },
  { title: "Manager", dataIndex: "manager", key: "manager" },
  { title: "Position", dataIndex: "position", key: "position" },
  { title: "Status", dataIndex: "status", key: "status" },
  { title: "Department", dataIndex: "deptname", key: "deptname" },
  { title: "Shift", dataIndex: "address", key: "address" },
  { title: "Hired Date", dataIndex: "hireddate", key: "hireddate" },
];


const data: DataType[] = [
  {
    key: "1",
    empname: "Alpha",
    manager: "John Doe",
    position: "IT",
    status: "Active",
    deptname: "Agents Department",
    shift: 1,
    hireddate: "01/15/2020",
  },
  {
    key: "2",
    empname: "Beta",
    manager: "John Doe",
    position: "IT",
    status: "Active",
    deptname: "Agents Department",
    shift: 1,
    hireddate: "01/15/2020",
  },
  {
    key: "3",
    empname: "Charlie",
    manager: "John Doe",
    position: "IT",
    status: "Active",
    deptname: "Agents Department",
    shift: 1,
    hireddate: "01/15/2020",
  },
];

const AdminDepartmentEmployee: React.FC = () => {
  const [open, setOpen] = useState(false);
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
          onClick={() => setOpen(true)}
        >
          Add Employee
        </Button>
        </div>

        <Table<DataType>
          columns={columns}
          dataSource={data}
          pagination={false}
          className={styles.table}
        />
        <AddAddDeptEmployee open={open} onClose={() => setOpen(false)} />
      </Layout.Content>
    </Layout>
  );
};

export default AdminDepartmentEmployee;
