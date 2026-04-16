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

import PayslipsTab from "../../HR/EmployeeDetailsPage/Tabs/PayslipsTab";

const { Content } = Layout;

interface AddressData {
  id: number;
  province: number;       
  province_name: string;  
  city: number;
  city_name: string;
  barangay: number;
  barangay_name: string;
  sitio?: string;
  street?: string;
  zip_code?: string;
}

interface EmployeeData {
  id_no: number;
  name: string;
  department_name: string;
  position: string;
  status: string;
  employment_status: string;
  shift_info: string | null;
  hired_date: string;
  bank_info: string;
  email: string;
  contact_no: string;
  address: AddressData;
  role: "EMPLOYEE" | "ADMIN" | "SUPER_ADMIN";
  profile_picture?: string;
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

  const isSuperAdminEmployee = employee?.role === "SUPER_ADMIN";

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
     TAX RETRIEVE STATE
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
        name: item.name, 
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
    fetchDeductions(empIdNum); 
  }, [employeeId]);

  // ======================
  // USER ACCOUNT READ-ONLY FOR SUPER_ADMIN
  // ======================
  const [userAccount, setUserAccount] = useState<any>(null);
  const [loadingUserAccount, setLoadingUserAccount] = useState(false);

  const fetchUserAccount = async () => {
    if (!employeeId) return;
    setLoadingUserAccount(true);
    try {
      const res = await api.get(`/employees/users/employee/${employeeId}/`);
      setUserAccount(res.data);
    } catch (err) {
      console.error(err);
      setUserAccount(null);
    } finally {
      setLoadingUserAccount(false);
    }
  };

  useEffect(() => {
    fetchUserAccount();
  }, [employeeId]);

  /* =========================
     AUDIT LOGS RETRIEVE STATE
  ========================== */
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchAuditLogs = async () => {
    if (!employeeId) return;

    setLoadingLogs(true);
    try {
      const res = await api.get(`/employees/auditlogs/employee/${employeeId}/`);
      setAuditLogs(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch audit logs");
      setAuditLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [employeeId]);

  /* =========================
      EMPLOYMENT STATUS RETRIEVE STATE
  ========================== */
  const [isEditEmploymentStatusOpen, setIsEditEmploymentStatusOpen] = useState(false);


  const salaryColumns = [
    {
      title: "Salary Amount",
      dataIndex: "base_rate",
      key: "base_rate",
      render: (val: number) => `₱${val.toLocaleString()}`, 
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
                <img
                  src={employee.profile_picture || "/avatar.jpg"}
                  className={styles.avatar}
                  alt={employee.name}
                />

                <div className={styles.nameSection}>
                  <div className={styles.nameTop}>
                    <h3 className={styles.name}>{employee.name}</h3>
                  </div>
                  <span className={styles.empId}>ID : {employee.id_no}</span>
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
                  <div className={styles.infoRow}>
                    <div className={styles.iconBox}>
                      <HomeOutlined />
                    </div>
                    <div>
                      <span className={styles.label}>Address</span>
                      <p>
                        {[
                          employee.address?.street,
                          employee.address?.sitio,
                          employee.address?.barangay_name,
                          employee.address?.city_name,
                          employee.address?.province_name,
                          employee.address?.zip_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  </div>

                </div>

                <div className={styles.infoRow}>
                  <div className={styles.iconBox}>
                    <UserOutlined />
                  </div>
                  <div className={styles.nameSection}>
                    <div className={styles.nameTop}>
                      <span className={styles.label}>Employment Status</span>
                    </div>

                    <p
                      style={{
                        fontWeight: 600,
                        color:
                          employee.employment_status === "REGULAR"
                            ? "green"
                            : employee.employment_status === "PROBATION"
                            ? "orange"
                            : employee.employment_status === "NEW_HIRE"
                            ? "blue"
                            : "purple",
                      }}
                    >
                      {employee.employment_status.replace("_", " ")}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* RIGHT SIDE */}
            <Card className={styles.detailsCard}>
              <Tabs defaultActiveKey="1">

                {/* BASE SALARY */}
                {!isSuperAdminEmployee && (
                  <Tabs.TabPane tab="Base Salary" key="1">
                    <div className={styles.salaryHeader}>
                      <h3>Base Salary</h3>
                    </div>

                    <Table
                      columns={salaryColumns}
                      dataSource={salaries}
                      loading={loadingSalaries}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  </Tabs.TabPane>
                )}

                {/* ALLOWANCE */}
                {!isSuperAdminEmployee && (
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
                      dataSource={allowances}
                      loading={loadingAllowances}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  </Tabs.TabPane>
                )}

                {/* TAX */}
                {!isSuperAdminEmployee && (
                  <Tabs.TabPane tab="Tax" key="3">
                    <div className={styles.salaryHeader}>
                      <h3>Mandatory Government Contribution</h3>
                    </div>

                    <Table
                      columns={[
                        { title: "Deduction", dataIndex: "name", key: "name" },
                        { title: "Frequency", dataIndex: "frequency", key: "frequency" },
                        { title: "Effective From", dataIndex: "effective_from", key: "effective_from" },
                        { title: "Amount", dataIndex: "amount", key: "amount" },
                      ]}
                      dataSource={deductions}
                      loading={loadingDeductions}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  </Tabs.TabPane>
                )}

                {/* PAYSLIPS */}
                {!isSuperAdminEmployee && (
                  <Tabs.TabPane tab="Payslips" key="4">
                    {employeeId && !isNaN(Number(employeeId)) && (
                      <PayslipsTab employeeId={Number(employeeId)} />
                    )}
                  </Tabs.TabPane>
                )}

                {/* EMPLOYEE ACCOUNT — READ ONLY FOR SUPER_ADMIN */}
                <Tabs.TabPane tab="Employee Account" key="5">
                  {loadingUserAccount ? (
                    <Spin tip="Loading user account..." />
                  ) : userAccount ? (
                    <Table
                      columns={[
                        { title: "Username", dataIndex: "user_name", key: "user_name" },
                        { title: "Role", dataIndex: "role", key: "role" },
                        {
                          title: "Status",
                          dataIndex: "is_active",
                          key: "is_active",
                          render: (val: boolean) => (val ? "Active" : "Inactive"),
                        },
                      ]}
                      dataSource={[userAccount]}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  ) : (
                    <p>No user account linked to this employee.</p>
                  )}
                </Tabs.TabPane>

                {/* AUDIT LOGS — ALWAYS VISIBLE */}
                <Tabs.TabPane tab="Audit Logs" key="6">
                  <div className={styles.salaryHeader}>
                    <h3>Audit Logs</h3>
                  </div>

                  <Table
                    columns={[
                      { title: "Action", dataIndex: "action", key: "action" },
                      { title: "User", dataIndex: "user", key: "user" },
                      { title: "Model", dataIndex: "model_name", key: "model_name" },
                      { title: "Old Data", dataIndex: "old_data", key: "old_data" },
                      { title: "New Data", dataIndex: "new_data", key: "new_data" },
                      { title: "Timestamp", dataIndex: "timestamp", key: "timestamp" },
                    ]}
                    dataSource={auditLogs}
                    loading={loadingLogs}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: "max-content" }}
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
