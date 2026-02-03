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
import styles from "./EmployeeDetPage.module.css";
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
     BASE SALARY MODAL STATE
  ========================== */
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryForm] = Form.useForm();

  const openSalaryModal = () => {
    setIsSalaryModalOpen(true);
  };

  const closeSalaryModal = () => {
    salaryForm.resetFields();
    setIsSalaryModalOpen(false);
  };

  const handleAddSalary = (values: any) => {
    console.log("Base Salary Data:", values);
    message.success("Base salary added successfully");
    closeSalaryModal();
    // TODO: POST to backend using employeeId
  };

  /* =========================
     ALLOWANCE MODAL STATE
  ========================== */
  const [isAllowanceModalOpen, setIsAllowanceModalOpen] = useState(false);
  const [allowanceForm] = Form.useForm();

  const openAllowanceModal = () => {
    setIsAllowanceModalOpen(true);
  };

  const closeAllowanceModal = () => {
    allowanceForm.resetFields();
    setIsAllowanceModalOpen(false);
  };

  const handleAddAllowance = (values: any) => {
    console.log("Allowance Data:", values);
    message.success("Allowance added successfully");
    closeAllowanceModal();
    // TODO: POST to backend using employeeId
  };

  /* =========================
     TAX MODAL STATE
  ========================== */
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [taxForm] = Form.useForm();

  const openTaxModal = () => {
    setIsTaxModalOpen(true);
  };

  const closeTaxModal = () => {
    taxForm.resetFields();
    setIsTaxModalOpen(false);
  };

  const handleAddTax = (values: any) => {
    console.log("Tax Data:", values);
    message.success("Tax/contributions added successfully");
    closeTaxModal();
    // TODO: POST to backend using employeeId
  };

  /* =========================
     FETCH EMPLOYEE DETAILS
  ========================== */
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        if (!employeeId) return;

        const res = await fetch(
          `http://localhost:8000/api/employees/employees/${employeeId}/details/`
        );

        if (!res.ok) throw new Error("Failed to fetch employee details");

        const data: EmployeeData = await res.json();
        setEmployee(data);
      } catch (error) {
        console.error(error);
        message.error("Error fetching employee details");
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
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      className={styles.editBtn}
                    />
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
                    <Button type="primary" onClick={openSalaryModal}>
                      Add New Base Salary
                    </Button>
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
                    <Button type="primary" onClick={openAllowanceModal}>
                      Add New Allowance
                    </Button>
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
                    <Button type="primary" onClick={openTaxModal}>
                      Add New Tax
                    </Button>
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

                <Tabs.TabPane tab="Password" key="5" />
              </Tabs>
            </Card>
          </div>
        </Content>
      </Layout>

      {/* =========================
          BASE SALARY MODAL
      ========================== */}
      <Modal
        title="Add Base Salary"
        open={isSalaryModalOpen}
        onCancel={closeSalaryModal}
        onOk={() => salaryForm.submit()}
        okText="Save"
      >
        <Form form={salaryForm} layout="vertical" onFinish={handleAddSalary}>
          <Form.Item
            label="Salary Amount"
            name="amount"
            rules={[{ required: true, message: "Please enter salary amount" }]}
          >
            <Input placeholder="e.g. 15000" />
          </Form.Item>

          <Form.Item
            label="Salary Type"
            name="type"
            rules={[{ required: true, message: "Please select salary type" }]}
          >
            <Select placeholder="Select type">
              <Select.Option value="Monthly">Monthly</Select.Option>
              <Select.Option value="Daily">Daily</Select.Option>
              <Select.Option value="Hourly">Hourly</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* =========================
          ALLOWANCE MODAL
      ========================== */}
      <Modal
        title="Add Employee Allowance"
        open={isAllowanceModalOpen}
        onCancel={closeAllowanceModal}
        onOk={() => allowanceForm.submit()}
        okText="Save"
      >
        <Form form={allowanceForm} layout="vertical" onFinish={handleAddAllowance}>
          <Form.Item
            label="Allowance Name"
            name="name"
            rules={[{ required: true, message: "Please enter allowance name" }]}
          >
            <Input placeholder="e.g. Transportation Allowance" />
          </Form.Item>

          <Form.Item
            label="Frequency"
            name="frequency"
            rules={[{ required: true, message: "Please select frequency" }]}
          >
            <Select placeholder="Select frequency">
              <Select.Option value="Per Pay Period">Per Pay Period</Select.Option>
              <Select.Option value="Monthly">Monthly</Select.Option>
              <Select.Option value="One-time">One-time</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Amount"
            name="amount"
            rules={[{ required: true, message: "Please enter amount" }]}
          >
            <Input placeholder="e.g. 500" />
          </Form.Item>
        </Form>
      </Modal>

      {/* =========================
          TAX MODAL
      ========================== */}
      <Modal
        title="Add Mandatory Government Contributions"
        open={isTaxModalOpen}
        onCancel={closeTaxModal}
        onOk={() => taxForm.submit()}
        okText="Save"
      >
        <Form form={taxForm} layout="vertical" onFinish={handleAddTax}>
          <Form.Item
            label="SSS"
            name="sss"
            rules={[{ required: true, message: "Please enter SSS amount" }]}
          >
            <Input placeholder="e.g. 1000" />
          </Form.Item>

          <Form.Item
            label="Phil-Health"
            name="philhealth"
            rules={[{ required: true, message: "Please enter Phil-Health amount" }]}
          >
            <Input placeholder="e.g. 500" />
          </Form.Item>

          <Form.Item
            label="Pag-IBIG"
            name="pagibig"
            rules={[{ required: true, message: "Please enter Pag-IBIG amount" }]}
          >
            <Input placeholder="e.g. 300" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default EmployeeDetailsPage;
