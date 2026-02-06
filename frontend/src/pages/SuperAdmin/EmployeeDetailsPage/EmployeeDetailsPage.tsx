import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Tabs,
  Button,
  Table,
  message,
  Spin,
  Modal,
  Form,
  Input,
  Select,
} from "antd";
import { useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "../../HR/EmployeeDetailsPage/EmployeeDetPage.module.css";
import {
  UserOutlined,
  BankOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EditOutlined,
} from "@ant-design/icons";
import api from "api/axios";

const { Content } = Layout;

interface EmployeeData {
  id: number;
  name: string;
  department_name: string;
  position: string;
  status: string;
  shift_info: string | null;
  hired_date: string;
  bank_info: string;
  email: string;
  contact_no: string;
  address: string;
}

const EmployeeDetailsPage: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();

  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  /* =========================
     FETCH EMPLOYEE DETAILS
  ========================== */
  useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeId) return;

      try {
        setLoading(true);

        const res = await api.get(
          `/employees/employees/${employeeId}/details/`
        );

        setEmployee(res.data);
      } catch (error: any) {
        console.error(error);
        message.error(
          error.response?.data?.message || "Error fetching employee details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const salaryColumns = [
    { title: "Salary", dataIndex: "salary", key: "salary" },
    { title: "Salary Type", dataIndex: "type", key: "type" },
  ];

  const salaryData = [{ key: "1", salary: "₱15,000", type: "Monthly" }];

  if (loading) return <Spin tip="Loading..." style={{ marginTop: 100 }} />;
  if (!employee) return <p style={{ marginTop: 100 }}>Employee not found.</p>;

  const employeeStatus: "active" | "deactivated" =
    employee.status.toLowerCase() === "active" ? "active" : "deactivated";

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
                    <h3 className={styles.name}>{employee.name}</h3>
                  </div>
                  <span className={styles.empId}>ID : {employee.id}</span>
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
                    <p>{employee.position}</p>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <BankOutlined />
                  </div>
                  <div>
                    <span className={styles.label}>Bank Info</span>
                    <p>{employee.bank_info}</p>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <ClockCircleOutlined />
                  </div>
                  <div>
                    <span className={styles.label}>Workshift</span>
                    <p>{employee.shift_info || "Not assigned"}</p>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <CalendarOutlined />
                  </div>
                  <div>
                    <span className={styles.label}>Hired Date</span>
                    <p>{employee.hired_date}</p>
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
                    <p>{employee.email}</p>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <PhoneOutlined />
                  </div>
                  <div>
                    <span className={styles.label}>Contact</span>
                    <p>{employee.contact_no}</p>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <HomeOutlined />
                  </div>
                  <div>
                    <span className={styles.label}>Address</span>
                    <p>{employee.address}</p>
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
                {/* BASE SALARY */}
                <Tabs.TabPane tab="Base Salary" key="1">
                  <div className={styles.salaryHeader}>
                    <h3>Base Salary</h3>
                    
                  </div>

                  <Table
                    columns={salaryColumns}
                    dataSource={salaryData}
                    pagination={false}
                  />
                </Tabs.TabPane>

                {/* ALLOWANCE */}
                <Tabs.TabPane tab="Allowance" key="2">
                  <div className={styles.salaryHeader}>
                    <h3>Allowance</h3>
                  </div>

                  <Table
                    columns={[
                      { title: "Allowance Name", dataIndex: "name", key: "name" },
                      { title: "Amount", dataIndex: "amount", key: "amount" },
                      { title: "Frequency", dataIndex: "frequency", key: "frequency" },
                      { title: "Status", dataIndex: "status", key: "status" },
                    ]}
                    dataSource={[
                      {
                        key: "1",
                        name: "Allowance",
                        amount: "₱500",
                        frequency: "Per Pay Period",
                        status: "Active",
                      },
                    ]}
                    pagination={false}
                  />
                </Tabs.TabPane>

                {/* TAX */}
                <Tabs.TabPane tab="Tax" key="3">
                  <div className={styles.salaryHeader}>
                    <h3>Mandatory Government Contribution</h3>
                  </div>

                  <Table
                    columns={[
                      { title: "Contribution", dataIndex: "name", key: "name" },
                      { title: "Amount", dataIndex: "amount", key: "amount" },
                    ]}
                    dataSource={[
                      { key: "1", name: "SSS", amount: "₱1,000" },
                      { key: "2", name: "Phil-Health", amount: "₱500" },
                      { key: "3", name: "Pag-IBIG", amount: "₱300" },
                    ]}
                    pagination={false}
                  />
                </Tabs.TabPane>

                {/* PAYSLIPS */}
                <Tabs.TabPane tab="Payslips" key="4">
                  <div className={styles.salaryHeader}>
                    <h3>Payslip</h3>
                  </div>

                  <Table
                    bordered
                    pagination={false}
                    columns={[
                      { title: "Earnings", dataIndex: "earningName", key: "earningName" },
                      { title: "Amount", dataIndex: "earningAmount", key: "earningAmount" },
                      { title: "Deductions", dataIndex: "deductionName", key: "deductionName" },
                      { title: "Amount", dataIndex: "deductionAmount", key: "deductionAmount" },
                    ]}
                    dataSource={[
                      {
                        key: "1",
                        earningName: "Basic Salary",
                        earningAmount: "₱600.00",
                        deductionName: "Absences",
                        deductionAmount: "₱600.00 (1 day)",
                      },
                    ]}
                  />
                </Tabs.TabPane>

              </Tabs>
            </Card>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default EmployeeDetailsPage;
