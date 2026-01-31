import React, { useState } from "react";
import { Layout, Table, Input, Button } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, SlidersOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Admin_DepartmentEmployee.module.css";
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
  const { deptId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);


  const columns: TableProps<DataType>["columns"] = [
    {
      title: "Employee Name",
      dataIndex: "empname",
      key: "empname",
      render: (text) => (
        <span className={styles.empLink}>{text}</span>
      ),
    },
    { title: "Manager", dataIndex: "manager", key: "manager" },
    { title: "Position", dataIndex: "position", key: "position" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Department", dataIndex: "deptname", key: "deptname" },
    { title: "Shift", dataIndex: "shift", key: "shift" },
    { title: "Hired Date", dataIndex: "hireddate", key: "hireddate" },
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

          <Table<DataType>
            columns={columns}
            dataSource={data}
            pagination={false}
            className={styles.table}
            onRow={(record) => ({
              onClick: () => navigate(`/admin/employee/employee-details`),
              style: { cursor: "pointer" },
            })}
          />

          <AddAddDeptEmployee open={open} onClose={() => setOpen(false)} />
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default AdminDepartmentEmployee;
