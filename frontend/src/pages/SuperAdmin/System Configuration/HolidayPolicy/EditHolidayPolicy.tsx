// src/pages/SuperAdmin/System Configuration/HolidayPolicy/EditHolidayPolicy.tsx
import { Modal, Form, Select, message, Spin, Radio } from "antd";
import { useEffect, useState } from "react";
import api from "../../../../api/axios";

const { Option } = Select;

type Props = {
  open: boolean;
  onClose: () => void;
  policy: any;
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

const EditHolidayPolicy = ({ open, onClose, policy, refresh }: Props) => {
  const [form] = Form.useForm();

  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<DepartmentType[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const [bases, setBases] = useState<BaseRow[]>([]);
  const [basesLoading, setBasesLoading] = useState(false);

  const selectedDepartment = Form.useWatch("department", form);

  const fetchDepartments = async () => {
    setDepartmentsLoading(true);
    try {
      const res = await api.get("employees/departments/");
      setDepartments(res.data || []);
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch departments");
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const fetchBases = async (departmentId: number) => {
    setBasesLoading(true);
    try {
      const res = await api.get(`approvals/departments/${departmentId}/holiday-bases/`);
      setBases(res.data || []);
    } catch (err) {
      console.error(err);
      setBases([]);
      message.error("Failed to load active bases for this department");
    } finally {
      setBasesLoading(false);
    }
  };

  // load departments when modal opens
  useEffect(() => {
    if (!open) return;
    fetchDepartments();
  }, [open]);

  // when department changes, load bases
  useEffect(() => {
    if (!open) return;

    if (!selectedDepartment) {
      setBases([]);
      form.setFieldsValue({ base: undefined });
      return;
    }

    fetchBases(selectedDepartment);
  }, [selectedDepartment, open]);

  // populate form when policy changes + modal opens
  useEffect(() => {
    if (!open) return;
    if (!policy) return;

    // set initial values
    form.setFieldsValue({
      department: policy.department,
      base: policy.base, // IMPORTANT: now part of the policy
      holiday_type: policy.holiday_type,
      requires_work: policy.requires_work,
    });

    // ensure bases are loaded for the existing department so base dropdown is valid
    if (policy.department) {
      fetchBases(policy.department);
    }
  }, [policy, open, form]);

  const handleSubmit = async () => {
    if (!policy?.id) return;

    try {
      const values = await form.validateFields();
      setSaving(true);

      await api.put(`approvals/holiday-policy/${policy.id}/`, values);

      message.success("Holiday policy updated successfully");
      refresh();
      onClose();
    } catch (err: any) {
      if (!err?.errorFields) {
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.base?.[0] ||
          "Failed to update holiday policy";
        message.error(detail);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit Holiday Policy"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={saving}
      okText="Update"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="department"
          label="Department"
          rules={[{ required: true, message: "Please select a department" }]}
        >
          {departmentsLoading ? (
            <Spin />
          ) : (
            <Select placeholder="Select department" showSearch optionFilterProp="children">
              {departments.map((dept) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Form.Item
          name="base"
          label="Base"
          rules={[{ required: true, message: "Please select a base" }]}
        >
          {basesLoading ? (
            <Spin />
          ) : (
            <Select
              placeholder={selectedDepartment ? "Select base" : "Select department first"}
              disabled={!selectedDepartment}
            >
              {bases.map((b) => (
                <Option key={b.base} value={b.base}>
                  {b.base} - {b.base_display}
                </Option>
              ))}
            </Select>
          )}
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
          label="Requires Work"
          rules={[{ required: true, message: "Select an option" }]}
        >
          <Radio.Group>
            <Radio value={true}>Required</Radio>
            <Radio value={false}>Not Required</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditHolidayPolicy;