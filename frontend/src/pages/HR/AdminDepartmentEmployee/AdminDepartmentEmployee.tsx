import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Layout, Table, Input, Button, message, Modal, Form, Select } from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/Sidebar/Sidebar";
import Topbar from "../../../components/Topbar/Topbar";
import styles from "./Admin_DepartmentEmployee.module.css";
// import AddAddDeptEmployee from "./AddAdDeptEmployee";
import AddEmployeeFlow from "./AddEmployee/AddEmployeeFlow";
import api from "api/axios";

interface EmployeeType {
  id: number;
  name: string;
  manager: string;
  position: string;
  status: string;
  department: string;
  shift: string;
  hired_date: string;
  profile_picture?: string;
}

const AdminDepartmentEmployee: React.FC = () => {
  const { deptId } = useParams<{ deptId: string }>();
  const [departmentShiftId, setDepartmentShiftId] = useState<number | null>(null);
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeType | null>(null);
  
  const [departments, setDepartments] = useState<any[]>([]);

  const location = useLocation();
  const deptName = (location.state as { deptName?: string })?.deptName || "Employees";

  const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace("/api", "");

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get("/employees/departments/");
        setDepartments(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    if (!deptId) return;

    setLoading(true);
    try {
      const res = await api.get(`/employees/employees/by-department/${deptId}/`);
      setEmployees(res.data); // axios already parses JSON
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [deptId]);

  const filteredEmployees = [...employees]
  .filter((emp) =>
    emp.name.toLowerCase().includes(search.toLowerCase())
  )
  .sort((a, b) => {
    return new Date(b.hired_date).getTime() - new Date(a.hired_date).getTime();
  });

  const columns: TableProps<EmployeeType>["columns"] = [
    {
      title: "Employee Name",
      dataIndex: "name",
      key: "name",
      render: (_, record) => {
        const imageUrl = record.profile_picture
          ? record.profile_picture.startsWith("http")
            ? record.profile_picture // already full URL
            : `${BASE_URL}${record.profile_picture}` // relative path
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(record.name)}`;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={imageUrl}
              alt={record.name}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
            <span className={styles.empLink}>{record.name}</span>
          </div>
        );
      },
    },
    { title: "Position", dataIndex: "position", key: "position" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Shift", dataIndex: "shift_info", key: "shift" },
    { title: "Hired Date", dataIndex: "hired_date", key: "hired_date" },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEmployee(record);
            setEditModalOpen(true);
          }}
        />
      ),
    },
  ];

  return (
    <Layout className={styles.layout} style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout>
        <Topbar title={deptName} showBack />

        <Layout.Content className={styles.content}>
          <div className={styles.topBar}>
            <div className={styles.leftControls}>
              <Input
                placeholder="Search"
                prefix={<SearchOutlined />}
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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

          <Table<EmployeeType>
            columns={columns}
            dataSource={filteredEmployees}
            rowKey="id"
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["5", "10", "20", "50"],
              showTotal: (total) => `Total ${total} employees`,
            }}
            className={styles.table}
            onRow={(record) => ({
              onClick: () =>
                navigate(
                  `/admin/department/employee/employee-details/${record.id}`
                ),
              style: { cursor: "pointer" },
            })}
          />

          <AddEmployeeFlow
            open={open}
            departmentId={Number(deptId)}
            allowedRoles={["EMPLOYEE"]} 
            onClose={() => {
              setOpen(false);
              fetchEmployees();
            }}
          />
          <Modal
            title="Change Department"
            open={editModalOpen}
            onCancel={() => setEditModalOpen(false)}
            footer={null}
          >
            <Form
              layout="vertical"
              onFinish={async (values) => {
                try {
                  await api.patch(
                    `/employees/employees/${selectedEmployee?.id}/change-department/`,
                    {
                      department_id: values.department_id,
                      reason: values.reason,
                    }
                  );

                  message.success("Department updated");
                  setEditModalOpen(false);
                  fetchEmployees();
                } catch (err: any) {
                  console.error(err);
                  message.error("Failed to update department");
                }
              }}
            >
              <Form.Item
                label="New Department"
                name="department_id"
                rules={[{ required: true, message: "Select department" }]}
              >
                <Select>
                  {departments
                    .filter((d) => d.id !== selectedEmployee?.department)
                    .map((dept) => (
                      <Select.Option key={dept.id} value={dept.id}>
                        {dept.name}
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Reason"
                name="reason"
                rules={[{ required: true, message: "Please provide a reason" }]}
              >
                <Input.TextArea placeholder="Reason for transfer" />
              </Form.Item>

              <Button type="primary" htmlType="submit" block>
                Save
              </Button>
            </Form>
          </Modal>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

export default AdminDepartmentEmployee;
