import React from "react";
import { Layout, Card, Row, Col, Input, Table, Avatar, Tag, Statistic } from "antd";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Attendance.module.css";

const { Content } = Layout;
const { Search } = Input;

const dataSource = [
  {
    key: "1",
    name: "Jeremy Neigh",
    avatar: "https://i.pravatar.cc/40?img=1",
    department: "HR",
    timeIn: "12:00 a.m",
    timeOut: "9:00 a.m",
    classification: "Full time",
    workshift: "12:00 - 9:00 a.m",
    date: "15/08/2017",
    status: "Complete",
  },
  {
    key: "2",
    name: "Annette Black",
    avatar: "https://i.pravatar.cc/40?img=2",
    department: "IT",
    timeIn: "12:00 a.m",
    timeOut: "9:00 a.m",
    classification: "Part-Time",
    workshift: "12:00 - 9:00 a.m",
    date: "16/08/2013",
    status: "Incomplete",
  },
  {
    key: "3",
    name: "Theresa Webb",
    avatar: "https://i.pravatar.cc/40?img=3",
    department: "Finance",
    timeIn: "12:00 a.m",
    timeOut: "9:00 a.m",
    classification: "Full time",
    workshift: "12:00 - 9:00 a.m",
    date: "07/05/2016",
    status: "Incomplete",
  },
];

const columns = [
  {
    title: "Name",
    dataIndex: "name",
    render: (_: any, record: any) => (
      <div className={styles.nameCell}>
        <Avatar src={record.avatar} />
        <span>{record.name}</span>
      </div>
    ),
  },
  { title: "Department", dataIndex: "department" },
  { title: "Time In", dataIndex: "timeIn" },
  { title: "Time Out", dataIndex: "timeOut" },
  { title: "Classification", dataIndex: "classification" },
  { title: "Workshift", dataIndex: "workshift" },
  { title: "Date", dataIndex: "date" },
  {
    title: "Status",
    dataIndex: "status",
    render: (status: string) => (
      <Tag color={status === "Complete" ? "green" : "orange"}>{status}</Tag>
    ),
  },
];

const Attendance: React.FC = () => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title="Attendance" />

        <Content className={styles.content}>
          {/* UPDATED STATS */}
          <Row gutter={16}>
            <Col span={6}><Card><Statistic title="Total Present" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Lates" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Total Absences" value={0} /></Card></Col>
            <Col span={6}><Card><Statistic title="Leave request pending" value={0} /></Card></Col>
          </Row>

          {/* TABLE CARD */}
          <Card className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <Search placeholder="Search" style={{ width: 250 }} />
            </div>

            <Table
              dataSource={dataSource}
              columns={columns}
              pagination={false}
              rowClassName={styles.rowStyle}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Attendance;
