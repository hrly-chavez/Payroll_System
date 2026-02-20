import { Modal, Form, Input, Select, Switch, message } from "antd";
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

  useEffect(() => {
    if (policy) {
      form.setFieldsValue(policy);
    }
  }, [policy, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.put(`holiday-policy/${policy.id}/`, values);

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
          rules={[{ required: true, message: "Please enter department" }]}
        >
          <Input />
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
          rules={[{ required: true, message: "Select option" }]}
        >
          <Select>
            <Option value="All">All</Option>
            <Option value="Required">Required</Option>
            <Option value="Not Required">Not Required</Option>
          </Select>
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