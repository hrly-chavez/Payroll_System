import { Modal, Form, Input, Select, Switch, message, Spin, Radio } from "antd";
import { useEffect, useState } from "react";
import api from "../../../../api/axios";

const { Option } = Select;

type Props = {
  open: boolean;
  onClose: () => void;
  policy: any;
  refresh: () => void;
};

const EditHolidayPolicy = ({ open, onClose, policy, refresh }: Props) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // Fetch departments from backend
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

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Populate form when policy changes
  useEffect(() => {
    if (policy && departments.length) {
      // Find the department object that matches the policy.department id
      const selectedDept = departments.find(
        (dept) => dept.id === policy.department
      );

      form.setFieldsValue({
        ...policy,
        department: selectedDept?.id || undefined, // set the ID
      });
    }
  }, [policy, departments, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.put(`approvals/holiday-policy/${policy.id}/`, values);

      message.success("Holiday policy updated successfully");
      refresh();
      onClose();
    } catch (err: any) {
      if (!err?.errorFields) {
        message.error("Failed to update holiday policy");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Edit Holiday Policy"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Update"
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
            <Select placeholder="Select department">
              {departments.map((dept) => (
                <Option key={dept.id} value={dept.id}>
                  {dept.name}
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
          <Select>
            <Option value="Regular">Regular</Option>
            <Option value="Special">Special</Option>
            <Option value="Company">Company</Option>
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

        <Form.Item
          name="is_active"
          label="Active"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditHolidayPolicy;