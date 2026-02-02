import React from "react";
import Sidebar from "../../../components/Sidebar/Sidebar";
import { Layout, Card, Table, Tag } from "antd";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Requests.module.css";

const { Content } = Layout;

const Requests: React.FC = () => {
  const columns = [
    {
      title: "Date",
      dataIndex: "date",
    },
    {
      title: "Description",
      dataIndex: "description",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) => {
        if (status === "APPROVED") return <Tag color="green">APPROVED</Tag>;
        if (status === "PENDING") return <Tag color="orange">PENDING</Tag>;
        return <Tag color="red">REJECTED</Tag>;
      },
    },
  ];

  const data = [
    {
      key: 1,
      date: "16/08/2013",
      description: "Attendance Correction Request",
      status: "APPROVED",
    },
    {
      key: 2,
      date: "12/06/2020",
      description: "Attendance Correction Request",
      status: "PENDING",
    },
    {
      key: 3,
      date: "07/05/2016",
      description: "Attendance Correction Request",
      status: "REJECTED",
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Requests" />

        <Content className={styles.content}>
          <Card className={styles.card}>
            <Table
              columns={columns}
              dataSource={data}
              pagination={false}
              rowClassName={styles.row}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Requests;
