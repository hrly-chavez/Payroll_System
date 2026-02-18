import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Button, DatePicker, Row, Col, message } from "antd";
import api from "../../api/axios"; // adjust path if needed
import styles from "../HR/AdminDepartmentEmployee/AddAdDeptEmployee.module.css";

const { Option } = Select;

interface Props {
  open: boolean;
  onNext: (employeeId: number, credentials: { username: string; password: string }) => void;
  onClose: () => void;
  mode?: "SUPERADMIN_SETUP";
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

const AddFirstSuperadmin: React.FC<Props> = ({ open, onNext, onClose, mode }) => {
  const [form] = Form.useForm();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // fetch provinces
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
      setLoading(true);

      const payload = {
        fname: values.fname,
        lname: values.lname,
        initial: values.initial || "",
        suffix: values.suffix || "",
        contact_no: values.contact_no,
        email: values.email,
        hired_date: values.hired_date.format("YYYY-MM-DD"),
        position: values.position,
        bank_info: values.bank_info || "",
        status: values.status,
        address: {
          street: values.address.street,
          sitio: values.address.sitio || "",
          barangay: values.address.barangay,
          city: values.address.city,
          province: values.address.province,
          zip_code: values.address.zip_code || "",
        },
      };

      const res = await api.post("/employees/employees/create-first-superadmin/", payload);

      message.success(`SUPER_ADMIN created! Username: ${res.data.username}, Password: ${res.data.password}`);
      form.resetFields();
      onNext(res.data.employee_id, { username: res.data.username, password: res.data.password });
    } catch (err: any) {
      console.error(err);
      message.error(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to create SUPER_ADMIN"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Create First SUPER_ADMIN"
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
          {/* Employee Info */}
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
            <Form.Item name="contact_no" label="Contact Number" rules={[{ required: true }]}>
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
            <Form.Item name="bank_info" label="Bank Info">
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24}><h3>Address</h3></Col>

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
          <Button type="primary" onClick={handleNext} loading={loading}>
            Create SUPER_ADMIN
          </Button>
          <Button onClick={onClose} style={{ marginLeft: 8 }}>
            Cancel
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddFirstSuperadmin;
