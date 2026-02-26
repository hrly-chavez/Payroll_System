// src/pages/SuperAdmin/System Configuration/HolidayPolicy/AddHolidayPolicy.tsx
import { Modal, Form, Select, Radio, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import api from "../../../../api/axios";

const { Option } = Select;

type Props = {
  open: boolean;
  onClose: () => void;
  refresh: () => void;
};

type DepartmentType = {
  id: number;
  name: string;
};

type BaseRow = {
  base: "PH" | "US" | "COMPANY";
  base_display: string;
};

const HOLIDAY_TYPES = [
  { value: "Regular", label: "Regular" },
  { value: "Special Non-Working", label: "Special Non-Working" },
  { value: "Special Working", label: "Special Working" },
  { value: "Company Holiday", label: "Company Holiday" },
];

const AddHolidayPolicy = ({ open, onClose, refresh }: Props) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [bases, setBases] = useState<BaseRow[]>([]);
  const selectedDepartment = Form.useWatch("department", form);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("employees/departments/");
      setDepartments(res.data || []);
    } catch {
      message.error("Failed to load departments");
    }
  };

  const fetchBases = async (departmentId: number) => {
    try {
      const res = await api.get(`approvals/departments/${departmentId}/holiday-bases/`);
      setBases(res.data || []);
    } catch (err) {
      console.error(err);
      setBases([]);
      message.error("Failed to load active bases for this department");
    }
  };

  useEffect(() => {
    if (!open) return;

    fetchDepartments();
    setBases([]);
    form.resetFields();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!selectedDepartment) {
      setBases([]);
      form.setFieldsValue({ base: undefined });
      return;
    }

    // When department changes, refetch bases and clear selected base
    form.setFieldsValue({ base: undefined });
    fetchBases(selectedDepartment);
  }, [selectedDepartment, open]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post("approvals/holiday-policy/", values);

      message.success("Holiday policy added successfully");
      form.resetFields();
      refresh();
      onClose();
    } catch (err: any) {
      if (!err?.errorFields) {
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.base?.[0] ||
          "Failed to add holiday policy";
        message.error(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Holiday Policy"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Save"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="department"
          label="Department"
          rules={[{ required: true, message: "Please select department" }]}
        >
          <Select placeholder="Select department" showSearch optionFilterProp="children">
            {departments.map((dept) => (
              <Option key={dept.id} value={dept.id}>
                {dept.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Base dropdown depends on Department */}
        <Form.Item
          name="base"
          label="Base"
          rules={[{ required: true, message: "Please select base" }]}
        >
          <Select placeholder={selectedDepartment ? "Select base" : "Select department first"} disabled={!selectedDepartment}>
            {bases.map((b) => (
              <Option key={b.base} value={b.base}>
                {b.base} - {b.base_display}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="holiday_type"
          label="Holiday Type"
          rules={[{ required: true, message: "Select holiday type" }]}
        >
          <Select placeholder="Select holiday type">
            {HOLIDAY_TYPES.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="requires_work"
          label="Requires Work?"
          rules={[{ required: true, message: "Please select option" }]}
        >
          <Radio.Group>
            <Radio value={true}>Required to Work</Radio>
            <Radio value={false}>Not Required</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddHolidayPolicy;