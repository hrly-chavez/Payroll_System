import React from "react";
import { Layout, Tabs, Table, DatePicker, Button, Avatar } from "antd";
import { PlusOutlined, CalendarOutlined } from "@ant-design/icons";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./reports.module.css";

const { Content } = Layout;
const { TabPane } = Tabs;

const data = [
  {
    key: 1,
    name: "Jeremy Neigh",
    avatar: "https://i.pravatar.cc/40?img=1",
    daysWorked: 10,
    lates: 15,
    undertime: 0,
    absences: 0,
    overtime: 4.0,
    absences2: 1,
    status: "Complete",
  },
  {
    key: 2,
    name: "Annette Black",
    avatar: "https://i.pravatar.cc/40?img=2",
    daysWorked: 9,
    lates: 45,
    undertime: 30,
    absences: 1,
    overtime: 0,
    absences2: 0,
    status: "With Issues",
  },
  {
    key: 3,
    name: "Theresa Webb",
    avatar: "https://i.pravatar.cc/40?img=3",
    daysWorked: 8,
    lates: 0,
    undertime: 60,
    absences: 2,
    overtime: 2.5,
    absences2: 0,
    status: "With Issues",
  },
];

const columns = [
  {
    title: "Employee name",
    dataIndex: "name",
    render: (_: any, record: any) => (
      <div className={styles.nameCell}>
        <Avatar src={record.avatar} />
        <span>{record.name}</span>
      </div>
    ),
  },
  { title: "Total days worked", dataIndex: "daysWorked" },
  { title: "Total lates (minutes)", dataIndex: "lates" },
  { title: "Total undertime", dataIndex: "undertime" },
  { title: "Total absences", dataIndex: "absences" },
  { title: "Overtime (hours)", dataIndex: "overtime" },
  { title: "Total absences", dataIndex: "absences2" },
  {
    title: "Attendance Status",
    dataIndex: "status",
    render: (text: string) => (
      <span className={text === "Complete" ? styles.complete : styles.issue}>
        {text}
      </span>
    ),
  },
];

const Reports: React.FC = () => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />

      <Layout>
        <Topbar title="Reports" />

        <Content className={styles.content}>
          <div className={styles.card}>
            <Tabs defaultActiveKey="1" className={styles.tabs}>
              <TabPane tab="Attendance Summary" key="1" />
            </Tabs>

            <div className={styles.headerActions}>
              <div className={styles.documentsTitle}>Documents</div>
              <div className={styles.actionsRight}>
                <DatePicker
                  suffixIcon={<CalendarOutlined />}
                  placeholder="Select Date"
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  className={styles.addBtn}
                >
                  Add new document
                </Button>
              </div>
            </div>

            <Table
              columns={columns}
              dataSource={data}
              pagination={false}
              scroll={{ x: "max-content" }}
              rowKey="key"
            />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default Reports;
