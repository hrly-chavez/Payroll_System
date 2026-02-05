import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import { useEffect, useState } from "react";
import api from "api/axios";

interface Props {
  open: boolean;
  employeeId: number;
  onNext: () => void;
  onClose: () => void;
}

const EmployeeContributionsModal: React.FC<Props> = ({ open, employeeId, onNext, onClose }) => {
  const [form] = Form.useForm();
  const [deductions, setDeductions] = useState<any[]>([]);

  useEffect(() => {
    api.get("/employees/deduction-types/").then(res => setDeductions(res.data));
  }, []);

  const submit = async () => {
    try {
      const v = await form.validateFields();

      await api.post("/employees/deductions/", {
        employee: employeeId,
        deduction_type: v.deduction_type,
        amount: v.amount,
        frequency: v.frequency,
        effective_from: v.effective_from.format("YYYY-MM-DD"),
        status: "Active",
      });

      message.success("Deduction saved");
      onNext();
    } catch {
      message.error("Failed to save deduction");
    }
  };

  return (
    <Modal open={open} title="Employee Contributions" footer={null} onCancel={onClose}>
      <Form layout="vertical" form={form}>
        <Form.Item name="deduction_type" label="Deduction Type" rules={[{ required: true }]}>
          <Select options={deductions.map(d => ({ label: d.code, value: d.id }))} />
        </Form.Item>

        <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
          <Select
            options={[
              { label: "Monthly", value: "Monthly" },
              { label: "Per Period", value: "Per Period" },
              { label: "One Time", value: "One Time" },
            ]}
          />
        </Form.Item>

        <Form.Item name="effective_from" label="Effective From" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button type="primary" block onClick={submit}>
          Next
        </Button>
      </Form>
    </Modal>
  );
};

export default EmployeeContributionsModal;
