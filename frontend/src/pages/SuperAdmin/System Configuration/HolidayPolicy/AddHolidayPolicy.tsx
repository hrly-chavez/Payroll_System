import { Modal, Form, Select, Switch, Radio, message } from "antd";
import { useEffect, useState } from "react";
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

const AddHolidayPolicy = ({ open, onClose, refresh }: Props) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentType[]>([]);

  /* =========================
     Fetch Departments
  ========================= */
  const fetchDepartments = async () => {
    try {
      const res = await api.get("departments/"); // adjust endpoint if needed
      setDepartments(res.data || []);
    } catch (err) {
      message.error("Failed to load departments");
    }
  };

  useEffect(() => {
    if (open) {
      fetchDepartments();
    }
  }, [open]);

  /* =========================
     Submit
  ========================= */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post("holiday-policy/", values);

      message.success("Holiday policy added successfully");
      form.resetFields();
      refresh();
      onClose();
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error("Failed to add holiday policy");
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
        {/* Department Dropdown */}
        <Form.Item
          name="department"
          label="Department"
          rules={[{ required: true, message: "Please select department" }]}
        >
          <Select placeholder="Select department">
            {departments.map((dept) => (
              <Option key={dept.id} value={dept.id}>
                {dept.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Holiday Type */}
        <Form.Item
          name="holiday_type"
          label="Holiday Type"
          rules={[{ required: true, message: "Select holiday type" }]}
        >
          <Select placeholder="Select holiday type">
            <Option value="Regular">Regular</Option>
            <Option value="Special">Special</Option>
            <Option value="Company">Company</Option>
          </Select>
        </Form.Item>

        {/* Requires Work (Radio Button) */}
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