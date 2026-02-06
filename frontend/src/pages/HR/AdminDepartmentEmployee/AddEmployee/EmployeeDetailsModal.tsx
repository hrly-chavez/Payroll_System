import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Button, DatePicker, Row, Col, message } from "antd";
import api from "api/axios";
import styles from "../AddAdDeptEmployee.module.css";

const { Option } = Select;

interface Props {
  open: boolean;
  onNext: (employeeId: number, credentials: { username: string; password: string }) => void;
  onClose: () => void;
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

const EmployeeDetailsModal: React.FC<Props> = ({ open, onNext, onClose }) => {
  const [form] = Form.useForm();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);

  const formatTime = (t: string) => t.slice(0, 5);

  // Fetch dropdown data
  useEffect(() => {
    api.get("/employees/shifts/").then(res => setShifts(res.data));
    api.get("/employees/departments/").then(res => setDepartments(res.data));
    api.get("/employees/provinces/").then(res => setProvinces(res.data));
  }, []);

  const handleProvinceChange = (provinceId: number) => {
    form.setFieldsValue({ address: { city: null, barangay: null } });
    setCities([]);
    setBarangays([]);
    if (!provinceId) return;

    api.get(`/employees/provinces/${provinceId}/cities/`).then(res => setCities(res.data));
  };

  const handleCityChange = (cityId: number) => {
    form.setFieldsValue({ address: { barangay: null } });
    setBarangays([]);
    if (!cityId) return;

    api.get(`/employees/cities/${cityId}/barangays/`).then(res => setBarangays(res.data));
  };

  const handleNext = async () => {
    try {
      const values = await form.validateFields();

      // Prepare payload (send IDs for province/city/barangay)
      const payload = {
        ...values,
        hired_date: values.hired_date.format("YYYY-MM-DD"),
      };

      const res = await api.post("/employees/employees/", payload);

      message.success("Employee created successfully!");
      onNext(res.data.employee_id, {
        username: res.data.username,
        password: res.data.password,
      });
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to create employee");
    }
  };

  return (
    <Modal
      title="Employee Details"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={800}
      className={styles.modal}
      closable={false}
    >
      <Form layout="vertical" form={form} className={styles.form}>
        <Row gutter={16}>
          {/* Employee Basic Info */}
          <Col xs={24} md={12}>
            <Form.Item name="id_no" label="Employee Number" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="status" label="Marital Status" rules={[{ required: true }]}>
              <Select>
                <Option value="SINGLE">Single</Option>
                <Option value="MARRIED">Married</Option>
                <Option value="WIDOWED">Widowed</Option>
                <Option value="SEPARATED">Separated</Option>
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="fname" label="First Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="initial" label="Middle Initial">
              <Input maxLength={1} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="lname" label="Last Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="suffix" label="Suffix">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="contact_no" label="Contact Number">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="hired_date" label="Hired Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="position" label="Position" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="bank_info" label="Bank Information">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="shift" label="Shift">
              <Select>
                {shifts.map(s => (
                  <Option key={s.id} value={s.id}>
                    {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="department" label="Department" rules={[{ required: true }]}>
              <Select
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </Col>

          {/* Address */}
          <Col span={24}><h3>Address</h3></Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "province"]} label="Province" rules={[{ required: true }]}>
              <Select placeholder="Select Province" onChange={handleProvinceChange}>
                {provinces.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "city"]} label="City / Municipality" rules={[{ required: true }]}>
              <Select placeholder="Select City" onChange={handleCityChange} disabled={cities.length === 0}>
                {cities.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "barangay"]} label="Barangay" rules={[{ required: true }]}>
              <Select placeholder="Select Barangay" disabled={barangays.length === 0}>
                {barangays.map(b => <Option key={b.id} value={b.id}>{b.name}</Option>)}
              </Select>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "sitio"]} label="Sitio">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "street"]} label="Street" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "zip_code"]} label="Zip Code" rules={[{ required: true }]}>
              <Input maxLength={4} />
            </Form.Item>
          </Col>
        </Row>

        <div className={styles.actions}>
          <Button type="primary" onClick={handleNext}>
            Next
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EmployeeDetailsModal;
