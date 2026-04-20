import React, { useEffect, useState } from "react";
import { Modal, Form, Select, Input, message } from "antd";
import api from "../../../../api/axios";

const { Option } = Select;

interface Props {
  open: boolean;
  employeeId: number;
  currentStatus: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditEmploymentStatusModal: React.FC<Props> = ({
  open,
  employeeId,
  currentStatus,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        employment_status: currentStatus,
      });
    }
  }, [open, currentStatus]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post(
        `/employees/employees/${employeeId}/update-employment-status/`,
        {
          employment_status: values.employment_status,
          reason: values.reason,
        }
      );

      message.success("Employment status updated");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      message.error(
        err.response?.data?.detail || "Failed to update employment status"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Update Employment Status"
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="Update"
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          name="employment_status"
          label="Employment Status"
          rules={[{ required: true }]}
        >
          <Select>
            <Option value="REGULAR">Regular</Option>
            <Option value="PROBATION">Probation</Option>
            <Option value="NEW_HIRE">New Hire</Option>
            <Option value="OJT">OJT</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="reason"
          label="Reason"
          rules={[{ required: true, message: "Reason is required" }]}
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditEmploymentStatusModal;