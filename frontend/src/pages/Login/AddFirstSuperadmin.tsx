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

  const sanitizeInput = (value: string) => {
    if (!value) return "";

    // Trim spaces
    let sanitized = value.trim();

    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Remove < and >
    sanitized = sanitized.replace(/[<>]/g, "");

    // Normalize spaces
    sanitized = sanitized.replace(/\s+/g, " ");

    return sanitized;
  };

  const validateContactNo = (value: string) => {
    const sanitized = sanitizeInput(value);
    if (!/^\d{11}$/.test(sanitized)) {
      throw new Error("Contact number must be exactly 11 digits.");
    }
    return sanitized;
  };

  const disablePastDates = (current: any) => {
    return current && current < new Date().setHours(0, 0, 0, 0);
  };

  const handleNext = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Sanitize all string inputs
      const payload = {
        fname: sanitizeInput(values.fname),
        lname: sanitizeInput(values.lname),
        initial: sanitizeInput(values.initial || ""),
        suffix: sanitizeInput(values.suffix || ""),
        contact_no: validateContactNo(values.contact_no),
        email: sanitizeInput(values.email),
        hired_date: values.hired_date.format("YYYY-MM-DD"),
        position: sanitizeInput(values.position),
        bank_info: sanitizeInput(values.bank_info || ""),
        status: values.status,
        address: {
          street: sanitizeInput(values.address?.street || ""),
          sitio: sanitizeInput(values.address?.sitio || ""),
          barangay: values.address?.barangay,
          city: values.address?.city,
          province: values.address?.province,
          zip_code: sanitizeInput(values.address?.zip_code || ""),
        },
      };

      // Extra validation: block if any field still contains < >
      const stringFields = Object.values(payload).flatMap(val =>
        typeof val === "object" && val !== null
          ? Object.values(val)
          : val
      );

      if (stringFields.some(v => typeof v === "string" && /[<>]/.test(v))) {
        message.error("Invalid characters detected.");
        setLoading(false);
        return;
      }

      const res = await api.post("/employees/employees/create-first-superadmin/", payload);

      message.success(`SUPER_ADMIN created! Username: ${res.data.username} password: ${res.data.password}`);

      form.resetFields();
      onNext(res.data.employee_id, {
        username: res.data.username,
        password: res.data.password,
      });

    } catch (err: any) {
      console.error(err);

      // --- Parse DRF field errors ---
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "object") {
          // DRF returns field errors as { field_name: [errors] }
          const messages: string[] = [];
          Object.values(data).forEach((val: any) => {
            if (Array.isArray(val)) {
              val.forEach(msg => messages.push(msg));
            } else if (typeof val === "string") {
              messages.push(val);
            }
          });

          if (messages.length > 0) {
            messages.forEach(msg => message.error(msg));
          } else {
            message.error("Failed to create First User");
          }
        } else if (typeof data === "string") {
          message.error(data);
        }
      } else {
        message.error("Failed to create First User");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to sanitize input on typing
  const handleSanitizeInput = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/[<>]/g, ""); // remove < >
    form.setFieldsValue({ [field]: sanitized });
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
              <Input onChange={handleSanitizeInput("fname")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="initial" label="Middle Initial">
              <Input maxLength={1} onChange={handleSanitizeInput("initial")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="lname" label="Last Name" rules={[{ required: true }]}>
              <Input onChange={handleSanitizeInput("lname")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="suffix" label="Suffix">
              <Input onChange={handleSanitizeInput("suffix")} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="contact_no" label="Contact Number" rules={[{ required: true }]}>
              <Input
                maxLength={11}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/\D/g, ""); // digits only
                  form.setFieldsValue({ contact_no: sanitized });
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="hired_date" label="Hired Date" rules={[{ required: true }]}>
              <DatePicker
                style={{ width: "100%" }}
                disabledDate={disablePastDates}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="position" label="Position" rules={[{ required: true }]}>
              <Input onChange={handleSanitizeInput("position")} />
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
            <Form.Item name={["address", "street"]} label="Street" >
              <Input />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name={["address", "zip_code"]} label="Zip Code">
              <Input
                maxLength={4} // optional: limit to 4 digits
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/\D/g, ""); // remove all non-digits
                  form.setFieldsValue({ address: { ...form.getFieldValue("address"), zip_code: sanitized } });
                }}
              />
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
