import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import api from "api/axios";
import { useState } from "react";

interface Props {
  open: boolean;
  employeeId: number;
  onNext: () => void;
  onClose: () => void;
}

const EmployeeSalaryModal: React.FC<Props> = ({ open, employeeId, onNext, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post("/employees/salaries/", {
        employee: employeeId,
        pay_type: values.pay_type,
        base_rate: values.base_rate,
        effective_from: values.effective_from.format("YYYY-MM-DD"),
      });

      message.success("Salary saved");
      onNext();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save salary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} title="Employee Salary" onCancel={onClose} footer={null}>
      <Form layout="vertical" form={form}>
        <Form.Item name="pay_type" label="Pay Type" rules={[{ required: true }]}>
          <Select
            options={[
              { label: "Monthly", value: "Monthly" },
              { label: "Per Period", value: "Per Period" },
              { label: "Daily", value: "Daily" },
              { label: "Hourly", value: "Hourly" },
            ]}
          />
        </Form.Item>

        <Form.Item name="base_rate" label="Base Rate" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        <Form.Item name="effective_from" label="Effective From" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button type="primary" block loading={loading} onClick={handleSubmit}>
          Next
        </Button>
      </Form>
    </Modal>
  );
};

export default EmployeeSalaryModal;
