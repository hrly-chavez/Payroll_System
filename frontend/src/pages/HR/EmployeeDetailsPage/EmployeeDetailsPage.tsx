import React, { useEffect, useState } from "react";
import {
  Layout,
  Card,
  Tabs,
  Button,
  Table,
  message,
  Spin,
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
import EditEmployeeSalaryModal from "./Modals/EditEmployeeSalaryModal";
import EditEmployeeAllowanceModal from "../EmployeeDetailsPage/Modals/EditEmployeeAllowanceModal";
import EditEmployeeDetailsModal from "./Modals/EditEmployeeDetailsModal";
import EditEmployeeAddressModal from "./Modals/EditEmployeeAddressModal";
import ForgotPasswordModal from "./Modals/ForgotPasswordModal";


const { Content } = Layout;

interface AddressData {
  id: number;
  province: number;       // FK ID
  province_name: string;  // the name we want to display
  city: number;
  city_name: string;
  barangay: number;
  barangay_name: string;
  sitio?: string;
  street?: string;
  zip_code?: string;
}

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
  address: AddressData;
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
  const [selectedSalary, setSelectedSalary] = useState<any>(null);

  const openSalaryModal = () => {
    if (!salaries.length) {
      message.warning("No salary record found");
      return;
    }

    setSelectedSalary(salaries[0]); // latest salary
    setIsSalaryModalOpen(true);
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
        id: item.id,
        allowance_type_id: item.allowance_type.id,
        name: item.allowance_type.name, // linked allowance type name
        amount: `₱${item.amount}`,
        frequency: item.frequency,
        status: item.status,
        effective_from: item.effective_from,
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
  const [isEditAllowanceModalOpen, setIsEditAllowanceModalOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<any | null>(null);

  const openEditAllowanceModal = (allowance: any) => {
    setEditingAllowance(allowance);
    setIsEditAllowanceModalOpen(true);
  };

  const closeEditAllowanceModal = () => {
    setEditingAllowance(null);
    setIsEditAllowanceModalOpen(false);
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

  /* =========================
     EMPLOYEE MODAL STATE
  ========================== */
  //employee details
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);

  //employee address details
  const [isEditAddressOpen, setIsEditAddressOpen] = useState(false);

  /* =========================
     EMPLOYEE ACCOUNT RETRIEVE STATE
  ========================== */
  // inside EmployeeDetailsPage component, near your other useState declarations
  const [userAccount, setUserAccount] = useState<{
    user_id: number;
    user_name: string;
    role: string;
    is_active: boolean;
  } | null>(null);

  const [loadingUser, setLoadingUser] = useState(false);

  const fetchUserAccount = async () => {
    if (!employeeId) return;

    setLoadingUser(true);
    try {
      const res = await api.get(`/employees/users/employee/${employeeId}/`);
      setUserAccount(res.data);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch user account");
      setUserAccount(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchUserAccount();
  }, [employeeId]);

  /* =========================
     EMPLOYEE ACCOUNT MODAL STATE
  ========================== */
  // Modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);

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
                      onClick={() => setIsEditEmployeeOpen(true)}
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
                  <div className={styles.nameSection}>
                    <div className={styles.nameTop}>
                      <span className={styles.label}>Address</span>

                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        className={styles.editBtn}
                        onClick={() => setIsEditAddressOpen(true)}
                      />

                    </div>

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
                  </div>

                  <Table
                    columns={[
                      { title: "Allowance Name", dataIndex: "name", key: "name" },
                      { title: "Amount", dataIndex: "amount", key: "amount" },
                      { title: "Frequency", dataIndex: "frequency", key: "frequency" },
                      { title: "Status", dataIndex: "status", key: "status" },
                      { title: "Effective from", dataIndex: "effective_from", key: "effective_from" },
                      {
                        title: "Action",
                        key: "action",
                        render: (_text, record) => (
                          <Button type="link" onClick={() => openEditAllowanceModal(record)}>
                            Edit
                          </Button>
                        ),
                      }
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

                <Tabs.TabPane tab="Employee Account" key="5">
                  <div className={styles.salaryHeader}>
                    <h3>Employee Account</h3>
                    <Button
                      type="primary"
                      onClick={() => setIsForgotPasswordOpen(true)}
                      disabled={!userAccount}
                    >
                      Reset Password
                    </Button>
                  </div>

                  {userAccount ? (
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
                      dataSource={[userAccount]} // just one row
                      pagination={false}
                    />
                  ) : (
                    <p>No user account linked to this employee.</p>
                  )}
                </Tabs.TabPane>

                <Tabs.TabPane tab="Audit Logs" key="6">
                  <Table
                    columns={[
                      { title: "Action", dataIndex: "action", key: "action" },
                      { title: "User ID", dataIndex: "user_id", key: "user_id" },
                      { title: "Model", dataIndex: "model_name", key: "model_name" },
                      { title: "Old Data", dataIndex: "old_data", key: "old_data", render: (val) => JSON.stringify(val) },
                      { title: "New Data", dataIndex: "new_data", key: "new_data", render: (val) => JSON.stringify(val) },
                      { title: "Timestamp", dataIndex: "timestamp", key: "timestamp" },
                    ]}
                    dataSource={auditLogs}
                    loading={loadingLogs}
                    rowKey="id"
                  />
                </Tabs.TabPane>


              </Tabs>
            </Card>
          </div>
        </Content>
      </Layout>

      <EditEmployeeAllowanceModal
        open={isEditAllowanceModalOpen}
        allowance={editingAllowance}
        employeeId={Number(employeeId)}
        onClose={closeEditAllowanceModal}
        onSuccess={() => {
          fetchAllowances(Number(employeeId));
          closeEditAllowanceModal();
        }}
      />

      <EditEmployeeSalaryModal
        open={isSalaryModalOpen}
        employeeId={Number(employeeId)}
        salary={selectedSalary}
        onSuccess={() => {
          fetchSalaries(Number(employeeId));
          fetchDeductions(Number(employeeId)); //  important
          setIsSalaryModalOpen(false);
        }}
        onClose={() => setIsSalaryModalOpen(false)}
      />

      <EditEmployeeDetailsModal
        open={isEditEmployeeOpen}
        employee={employee}
        onClose={() => setIsEditEmployeeOpen(false)}
        onSuccess={() => {
          setIsEditEmployeeOpen(false); // close the modal immediately
          message.success("Employee updated successfully");

          // Refresh employee details after 5 seconds
          setTimeout(async () => {
            if (!employeeId) return;
            try {
              setLoading(true);
              const res = await api.get(`/employees/employees/${employeeId}/details/`);
              setEmployee(res.data);
              message.success("Employee data refreshed");
            } catch (error: any) {
              console.error(error);
              message.error(
                error.response?.data?.message || "Error refreshing employee details"
              );
            } finally {
              setLoading(false);
            }
          }, 3000); // 3 seconds
        }}
      />

      <EditEmployeeAddressModal
        open={isEditAddressOpen}
        employeeId={Number(employeeId)}
        address={employee.address}
        onClose={() => setIsEditAddressOpen(false)}
        onSuccess={async () => {
          setIsEditAddressOpen(false);

          // Refresh employee data
          const res = await api.get(
            `/employees/employees/${employeeId}/details/`
          );
          setEmployee(res.data);
        }}
      />

      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        username={userAccount?.user_name || ""}
        userId={userAccount?.user_id} // pass the PK
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccess={() => {
          setIsForgotPasswordOpen(false);
          fetchUserAccount();
        }}
      />
    </Layout>
  );
};

export default EmployeeDetailsPage;
