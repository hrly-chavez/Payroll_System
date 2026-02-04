import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  DatePicker,
  Switch,
  Row,
  Col,
} from "antd";
import { message } from "antd";
import styles from "./AddAdDeptEmployee.module.css";
import api from "api/axios";

interface Props {
  open: boolean;
  onClose: () => void;
}

const { Option } = Select;

interface Province {
  id: number;
  name: string;
}

interface City {
  id: number;
  name: string;
}

interface Barangay {
  id: number;
  name: string;
}

interface Shift {
  id: number;
  start_time: string;
  end_time: string;
}

interface Department {
  id: number;
  name: string;
}

const AddAdDeptEmployee: React.FC<Props> = ({ open, onClose }) => {
  //forms sa tanan para inig create
  const [form] = Form.useForm();

  //drop down sa address
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  //drop down sa shifts
  const [shifts, setShifts] = useState<Shift[]>([]);

  //drop down sa department
  const [departments, setDepartments] = useState<Department[]>([]);


  //change to hh:mm instead to hh:mm:ss format
  const formatTime = (t: string) => t.slice(0, 5);

  //this is to display the created user
  const [credentialsModal, setCredentialsModal] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState({ username: "", password: "" });

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const res = await api.get("/employees/shifts/");
        console.log("Shifts fetched:", res.data);
        setShifts(res.data);
      } catch (err: any) {
        console.error("Failed to fetch shifts:", err);
      }
    };

    fetchShifts();
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get("/employees/departments/");
        console.log("Departments fetched:", res.data);
        setDepartments(res.data);
      } catch (err: any) {
        console.error("Failed to fetch departments:", err);
      }
    };

    fetchDepartments();
  }, []);

  // Fetch provinces on mount
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        const res = await api.get("/employees/provinces/");
        console.log("Provinces fetched:", res.data);
        setProvinces(res.data);
      } catch (err: any) {
        console.error("Failed to fetch provinces:", err);
      }
    };

    fetchProvinces();
  }, []);

  const handleProvinceChange = async (provinceId: number) => {
    setCities([]);
    setBarangays([]);

    try {
      const res = await api.get(`/employees/provinces/${provinceId}/cities/`);
      setCities(res.data);
    } catch (err: any) {
      console.error("Failed to fetch cities:", err);
    }
  };

  const handleCityChange = async (cityId: number) => {
    setBarangays([]);

    try {
      const res = await api.get(`/employees/cities/${cityId}/barangays/`);
      setBarangays(res.data);
    } catch (err: any) {
      console.error("Failed to fetch barangays:", err);
    }
  };

  const handleSubmit = async (values: any) => {
    const payload = {
      ...values,
      hired_date: values.hired_date.format("YYYY-MM-DD"),
    };

    try {
      const res = await api.post("/employees/employees/", payload);
      console.log("Employee created:", res.data);

      // Display the returned credentials in modal
      if (res.data.username && res.data.password) {
        setGeneratedCredentials({ username: res.data.username, password: res.data.password });
        setCredentialsModal(true);
      }

      form.resetFields();
      onClose();
      message.success("Employee created successfully!");
    } catch (err: any) {
      console.error("Error creating employee:", err);
      message.error(err.response?.data?.message || "Error creating employee");
    }
  };


  return (
    <>
      <Modal
        title="Employee Details"
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        width={800}
        className={styles.modal}
      >
        <Form layout="vertical" className={styles.form} onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Employee Number"
                name="id_no"
                rules={[{ required: true }]}
              >
                <Input placeholder="Employee Number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Marital Status"
                name="status"
                rules={[{ required: true }]}
              >
                <Select placeholder="Select status">
                  <Option value="SINGLE">Single</Option>
                  <Option value="MARRIED">Married</Option>
                  <Option value="WIDOWED">Widowed</Option>
                  <Option value="SEPARATED">Separated</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="First Name"
                name="fname"
                rules={[{ required: true }]}
              >
                <Input placeholder="First Name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Middle Initial" name="initial">
                <Input maxLength={1} placeholder="M" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Last Name"
                name="lname"
                rules={[{ required: true }]}
              >
                <Input placeholder="Last Name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Suffix" name="suffix">
                <Input placeholder="Jr, Sr, III" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Contact Number" name="contact_no">
                <Input placeholder="09XXXXXXXXX" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ type: "email", required: true }]}
              >
                <Input placeholder="email@example.com" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Hired Date"
                name="hired_date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Position"
                name="position"
                rules={[{ required: true }]}
              >
                <Input placeholder="Position" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Bank Information" name="bank_info">
                <Input placeholder="Bank / Account Number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Shift" name="shift">
                <Select placeholder="Select shift" optionLabelProp="children">
                  {shifts.map((shift) => (
                    <Option key={shift.id} value={shift.id}>
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Department"
                name="department"
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select department"
                  options={departments.map((dept) => ({
                    value: dept.id,
                    label: dept.name,
                  }))}
                  loading={departments.length === 0}
                />
              </Form.Item>
            </Col>

            {/* Address Section */}
            <Col span={24}>
              <h3 style={{ marginTop: 16 }}>Address Information</h3>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Province"
                name={["address", "province"]}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select Province"
                  onChange={handleProvinceChange}
                  showSearch
                  optionFilterProp="children"
                >
                  {provinces.map((prov) => (
                    <Option key={prov.id} value={prov.id}>
                      {prov.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="City / Municipality"
                name={["address", "city"]}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select City / Municipality"
                  onChange={handleCityChange}
                  disabled={cities.length === 0}
                  showSearch
                  optionFilterProp="children"
                >
                  {cities.map((city) => (
                    <Option key={city.id} value={city.id}>
                      {city.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Barangay"
                name={["address", "barangay"]}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder="Select Barangay"
                  disabled={barangays.length === 0}
                  showSearch
                  optionFilterProp="children"
                >
                  {barangays.map((brgy) => (
                    <Option key={brgy.id} value={brgy.id}>
                      {brgy.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Sitio / Street / Zip Code */}
            <Col xs={24} md={12}>
              <Form.Item label="Sitio" name={["address", "sitio"]}>
                <Input placeholder="Sitio (optional)" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Street"
                name={["address", "street"]}
                rules={[{ required: true }]}
              >
                <Input placeholder="Street Name / House No." />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Zip Code"
                name={["address", "zip_code"]}
                rules={[
                  { required: true },
                  { pattern: /^\d{4}$/, message: "Zip code must be 4 digits" },
                ]}
              >
                <Input placeholder="e.g. 1000" maxLength={4} />
              </Form.Item>
            </Col>
          </Row>

          <div className={styles.actions}>
            <Button type="primary" htmlType="submit">
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal for showing generated username and password */}
      <Modal
        title="Employee Login Credentials"
        open={credentialsModal}
        onCancel={() => setCredentialsModal(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setCredentialsModal(false)}>
            OK
          </Button>,
        ]}
      >
        <p>
          <strong>Username:</strong> {generatedCredentials.username}
        </p>
        <p>
          <strong>Password:</strong> {generatedCredentials.password}
        </p>
        <p>Please copy or communicate these credentials to the employee.</p>
      </Modal>

    </>
  );
};

export default AddAdDeptEmployee;
