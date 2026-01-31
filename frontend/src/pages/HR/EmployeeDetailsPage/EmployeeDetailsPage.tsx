import { useNavigate } from "react-router-dom";
import React from "react";
import { Layout, Card, Tabs, Button, Table } from "antd";
import { useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./EmployeeDetPage.module.css";
import {
  UserOutlined,
  BankOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CheckCircleFilled,StopOutlined,
  CheckCircleOutlined,
  EditOutlined,
} from "@ant-design/icons";


const { Content } = Layout;

const EmployeeDetailsPage: React.FC = () => {
  const { empId } = useParams();
  const {empName} = useParams();

  const salaryColumns = [
    { title: "Salary", dataIndex: "salary", key: "salary" },
    { title: "Salary Type", dataIndex: "type", key: "type" },
  ];

  const salaryData = [
    { key: "1", salary: "₱15,000", type: "Monthly" },
  ];
  
  const employeeStatus: "active" | "deactivated" = "active";

  return (
    <Layout className={styles.layout}>
      <Sidebar />
      <Layout>
        <Topbar title="Employee Detail’s Page" showBack />
        <Content className={styles.content}>
          <div className={styles.container}>

            {/* LEFT PROFILE CARD */}
            <Card className={styles.profileCard}>
              <div className={styles.profileHeader}>
                <img src="/avatar.jpg" className={styles.avatar} alt="avatar" />

                <div className={styles.nameSection}>
                    <div className={styles.nameTop}>
                    <h3 className={styles.name}>Kimi Räikkönen</h3>

                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        className={styles.editBtn}
                    />
                    </div>

                    <span className={styles.empId}>ID : 3258-0400</span>
                </div>
                </div>

              <div className={styles.infoBlock}>
                <h4>Info</h4>
                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <UserOutlined />
                </div>
                <div>
                    <span className={styles.label}>Position</span>
                    <p>IT</p>
                </div>
                </div>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <BankOutlined />
                </div>
                <div>
                    <span className={styles.label}>Bank Info</span>
                    <p>BDO - 1010101010</p>
                </div>
                </div>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <ClockCircleOutlined />
                </div>
                <div>
                    <span className={styles.label}>Workshift</span>
                    <p>Regular</p>
                </div>
                </div>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <CalendarOutlined />
                </div>
                <div>
                    <span className={styles.label}>Hired Date</span>
                    <p>12 February 2023</p>
                </div>
                </div>
                </div>

                <div className={styles.infoBlock}>
                <h4>Contact</h4>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <MailOutlined />
                </div>
                <div>
                    <span className={styles.label}>Email</span>
                    <p>sample@gmail.com</p>
                </div>
                </div>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <PhoneOutlined />
                </div>
                <div>
                    <span className={styles.label}>Contact</span>
                    <p>+628283386756</p>
                </div>
                </div>

                <div className={styles.infoRow}>
                <div className={styles.iconBox}>
                    <HomeOutlined />
                </div>
                <div>
                    <span className={styles.label}>Address</span>
                    <p>Cebu City, Philippines</p>
                </div>
                </div>
                <div className={styles.statusRow}>
                <div className={styles.iconBox}>
                    {employeeStatus === "active" ? (
                    <CheckCircleOutlined className={styles.activeIcon} />
                    ) : (
                    <StopOutlined className={styles.inactiveIcon} />
                    )}
                </div>

                <div>
                    <span className={styles.label}>Status</span>
                    <p
                    className={
                        employeeStatus === "active"
                        ? styles.activeText
                        : styles.inactiveText
                    }
                    >
                    {employeeStatus === "active" ? "Active" : "Deactivated"}
                    </p>
                </div>
                </div>

                </div>
            </Card>

            {/* RIGHT SIDE */}
            <Card className={styles.detailsCard}>
              <Tabs defaultActiveKey="1">
                <Tabs.TabPane tab="Base Salary" key="1">
                  <div className={styles.salaryHeader}>
                    <h3>Base Salary</h3>
                    <Button type="primary">Add New Base Salary</Button>
                  </div>

                  <Table
                    columns={salaryColumns}
                    dataSource={salaryData}
                    pagination={false}
                  />
                </Tabs.TabPane>

                <Tabs.TabPane tab="Allowance" key="2" />
                <Tabs.TabPane tab="Tax" key="3" />
                <Tabs.TabPane tab="Payslips" key="4" />
                <Tabs.TabPane tab="Password" key="5" />
              </Tabs>
            </Card>

          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default EmployeeDetailsPage;
