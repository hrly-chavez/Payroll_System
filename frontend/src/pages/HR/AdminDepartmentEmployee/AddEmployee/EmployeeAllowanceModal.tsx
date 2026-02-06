import { Modal, Form, Select, InputNumber, DatePicker, Button, message, Divider, List } from "antd";
import { useEffect, useState } from "react";
import api from "api/axios";

interface Props {
  open: boolean;
  employeeId: number;
  onClose: () => void;
  onNext: () => void; // NEW
}


const EmployeeAllowanceModal: React.FC<Props> = ({ open, employeeId, onNext, onClose }) => {
  const [form] = Form.useForm();
  const [allowances, setAllowances] = useState<any[]>([]);
  const [submittedAllowances, setSubmittedAllowances] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;

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

  const addAllowance = async () => {
    try {
      const v = await form.validateFields();

      const payload = {
        employee: employeeId,
        allowance_type: v.allowance_type,
        amount: v.amount,
        frequency: v.frequency,
        effective_from: v.effective_from.format("YYYY-MM-DD"),
        status: "Active",
      };

      await api.post("/employees/allowances/", payload);

      message.success("Allowance added");

      // Add to local list
      setSubmittedAllowances((prev) => [...prev, payload]);

      // Reset form for next entry
      form.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to add allowance");
    }
  };

  const submitAll = () => {
    if (submittedAllowances.length === 0) {
      message.warning("Please add at least one allowance");
      return;
    }
    onClose();
    onNext();
  };

  return (
    <Modal
      open={open}
      title="Employee Allowances"
      footer={null}
      onCancel={onClose}
      closable={false}
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          name="allowance_type"
          label="Allowance Type"
          rules={[{ required: true, message: "Please select an allowance type" }]}
        >
          <Select
            placeholder="Select allowance type"
            options={allowances
              // Filter out already added allowance types
              .filter(a => !submittedAllowances.some(sa => sa.allowance_type === a.id))
              .map(a => ({ label: a.name, value: a.id }))}
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

        <Button
          type="default"
          block
          style={{ marginBottom: 8 }}
          onClick={addAllowance}
          disabled={submittedAllowances.length >= allowances.length}
        >
          Add Allowance
        </Button>

        <Button type="primary" block onClick={submitAll}>
          Next
        </Button>

        {submittedAllowances.length > 0 && (
          <>
            <Divider>Added Allowances</Divider>
            <List
              size="small"
              dataSource={submittedAllowances}
              renderItem={(item, idx) => (
                <List.Item key={idx}>
                  {`${item.allowance_type} - ${item.amount} (${item.frequency}) from ${item.effective_from}`}
                </List.Item>
              )}
            />
          </>
        )}
      </Form>
    </Modal>
  );
};

export default EmployeeAllowanceModal;
