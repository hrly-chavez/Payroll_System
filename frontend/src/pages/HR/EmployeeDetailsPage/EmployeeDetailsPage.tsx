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

interface DeductionRow {
  key: string;
  name: string;
  amount: string;
  frequency: string;
  effective_from: string;
  type: "Mandatory" | "Optional";
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
     SALARY RETRIEVE DATA
  ========================== */
  const [salaries, setSalaries] = useState<
    { base_rate: number; pay_type: string; effective_from: string; id: number }[]
  >([]);
  const [loadingSalaries, setLoadingSalaries] = useState(false);


  const fetchSalaries = async (employeeId: number) => {
    setLoadingSalaries(true);
    try {
      const response = await api.get("/employees/salaries/", {
        params: { employee: employeeId },
      });

      // Map to table data
      const tableData = response.data.map((item: any) => ({
        key: item.id,
        base_rate: item.base_rate,
        pay_type: item.pay_type,
        effective_from: item.effective_from,
        id: item.id,
      }));

      setSalaries(tableData);
    } catch (error: any) {
      console.error(error);
      message.error("Failed to fetch salary history");
      setSalaries([]);
    } finally {
      setLoadingSalaries(false);
    }
  };


  useEffect(() => {
    if (!employeeId) return;

    const empIdNum = Number(employeeId);

    // Fetch allowances
    fetchAllowances(empIdNum);

    // Fetch salary history
    fetchSalaries(empIdNum);
  }, [employeeId]);



  /* =========================
     ALLOWANCE RETRIEVE DATA
  ========================== */

  const [allowances, setAllowances] = useState<any[]>([]);
  const [loadingAllowances, setLoadingAllowances] = useState(false);

  const fetchAllowances = async (employeeId: number) => {
    setLoadingAllowances(true);
    try {
      const response = await api.get("/employees/allowances/", {
        params: { employee: employeeId }, // backend filters by employee_id
      });

      const tableData = response.data.map((item: any, index: number) => ({
        key: index.toString(),
        name: item.allowance_type.name, // linked allowance type name
        amount: `₱${item.amount}`,
        frequency: item.frequency,
        status: item.status,
      }));

      setAllowances(tableData);
    } catch (error: any) {
      message.error("Failed to fetch allowances");
      console.error(error);
    } finally {
      setLoadingAllowances(false);
    }
  };


  useEffect(() => {
    if (!employeeId) return;
    fetchAllowances(Number(employeeId)); // convert string param to number
  }, [employeeId]);

  /* =========================
     TAX MODAL STATE
  ========================== */
  
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [loadingDeductions, setLoadingDeductions] = useState(false);

  const fetchDeductions = async (employeeId: number) => {
    setLoadingDeductions(true);
    try {
      const response = await api.get("/employees/deductions/", {
        params: { employee: employeeId },
      });

      const tableData = response.data.map((item: any) => ({
        key: item.id,
        name: item.name, // ✅ already resolved by backend
        amount: `₱${Number(item.amount).toLocaleString()}`,
        frequency: item.frequency,
        effective_from: item.effective_from,
      }));


      setDeductions(tableData);
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch deductions");
      setDeductions([]);
    } finally {
      setLoadingDeductions(false);
    }
  };

  useEffect(() => {
    if (!employeeId) return;

    const empIdNum = Number(employeeId);

    fetchAllowances(empIdNum);
    fetchSalaries(empIdNum);
    fetchDeductions(empIdNum); // ✅ ADD THIS
  }, [employeeId]);


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
    {
      title: "Salary Amount",
      dataIndex: "base_rate",
      key: "base_rate",
      render: (val: number) => `₱${val.toLocaleString()}`, // format with commas
    },
    {
      title: "Salary Type",
      dataIndex: "pay_type",
      key: "pay_type",
    },
    {
      title: "Effective From",
      dataIndex: "effective_from",
      key: "effective_from",
    },
  ];

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
                      Edit Base Salary
                    </Button>
                  </div>

                  <Table
                    columns={salaryColumns}
                    dataSource={salaries}
                    loading={loadingSalaries}
                    pagination={false}
                  />
                </Tabs.TabPane>


                {/* ALLOWANCE */}
                <Tabs.TabPane tab="Allowance" key="2">
                  <div className={styles.salaryHeader}>
                    <h3>Allowance</h3>
                    <Button type="primary" onClick={openAllowanceModal}>
                      Edit Allowance
                    </Button>
                  </div>

                  <Table
                    columns={[
                      { title: "Allowance Name", dataIndex: "name", key: "name" },
                      { title: "Amount", dataIndex: "amount", key: "amount" },
                      { title: "Frequency", dataIndex: "frequency", key: "frequency" },
                      { title: "Status", dataIndex: "status", key: "status" },
                    ]}
                    dataSource={allowances}
                    loading={loadingAllowances}
                    pagination={false}
                  />
                </Tabs.TabPane>

                {/* TAX */}
                <Tabs.TabPane tab="Tax" key="3">
                  <div className={styles.salaryHeader}>
                    <h3>Mandatory Government Contribution</h3>
                    <Button type="primary" onClick={openTaxModal}>
                      Edit Tax
                    </Button>
                  </div>

                  <Table
                    columns={[
                      { title: "Deduction", dataIndex: "name", key: "name" },
                      { title: "Type", dataIndex: "type", key: "type" },
                      { title: "Frequency", dataIndex: "frequency", key: "frequency" },
                      { title: "Effective From", dataIndex: "effective_from", key: "effective_from" },
                      { title: "Amount", dataIndex: "amount", key: "amount" },
                    ]}
                    dataSource={deductions}
                    loading={loadingDeductions}
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

                <Tabs.TabPane tab="Password" key="5">
                  <div className={styles.salaryHeader}>
                    <h3>Employee Account</h3>
                    <Button type="primary">
                      Change Pass
                    </Button>
                  </div>

                </Tabs.TabPane>
                    
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
