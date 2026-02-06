import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import { useEffect, useState } from "react";
import api from "api/axios";

interface Props {
  open: boolean;
  employeeId: number;
  onNext: (creds: { username: string; password: string }) => void;
  onClose: () => void;
}

const EmployeeAllowanceModal: React.FC<Props> = ({ open, employeeId, onNext, onClose }) => {
  const [form] = Form.useForm();
  const [allowances, setAllowances] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return; // only fetch when modal is opened

    const loadAllowances = async () => {
      try {
        const res = await api.get("/employees/allowance-types/");
        setAllowances(res.data);
      } catch {
        message.error("Failed to load allowance types");
      }
    };

    loadAllowances();
  }, [open]);


  const submit = async () => {
    try {
      const v = await form.validateFields();

      await api.post("/employees/allowances/", {
        employee: employeeId,
        allowance_type: v.allowance_type,
        amount: v.amount,
        frequency: v.frequency,
        effective_from: v.effective_from.format("YYYY-MM-DD"),
        status: "Active",
      });

      message.success("Allowance saved");
      onNext({ username: v.username, password: v.password });
    } catch {
      message.error("Failed to save allowance");
    }
  };

  return (
    <Modal open={open} title="Employee Allowances" footer={null} onCancel={onClose}>
      <Form layout="vertical" form={form}>
        <Form.Item
          name="allowance_type"
          label="Allowance Type"
          rules={[{ required: true, message: "Please select an allowance type" }]}
        >
          <Select
            placeholder="Select allowance type"
            options={allowances.map(a => ({ label: a.name, value: a.id }))}
          />
        </Form.Item>


        <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
          <Select options={[
            { label: "Monthly", value: "Monthly" },
            { label: "Per Period", value: "Per Period" },
            { label: "One Time", value: "One Time" },
          ]} />
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

export default EmployeeAllowanceModal;
