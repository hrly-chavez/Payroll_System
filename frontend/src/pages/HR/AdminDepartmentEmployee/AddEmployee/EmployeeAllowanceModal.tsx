import { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Button,
  List,
  message,
} from "antd";
import dayjs from "dayjs";
import api from "../../../../api/axios";

// What parent might pass
interface IncomingAllowanceItem {
  allowance_type: number | { id: number };
  amount: number;
  frequency: string;
  effective_from: string;
  status: string;
}

// What we store internally (CLEAN)
interface AllowanceItem {
  allowance_type: number;
  amount: number;
  frequency: string;
  effective_from: string;
  status: string;
}

interface Props {
  open: boolean;
  initialValues?: IncomingAllowanceItem[];
  onBack: () => void;
  onNext: (data: AllowanceItem[]) => void;
  onClose: () => void;
}

export default function EmployeeAllowanceModal({
  open,
  initialValues = [],
  onBack,
  onNext,
  onClose,
}: Props) {
  const [form] = Form.useForm();
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  const [submittedAllowances, setSubmittedAllowances] =
    useState<AllowanceItem[]>([]);

  // ✅ Single useEffect
  useEffect(() => {
    if (!open) return;

    const loadAllowanceTypes = async () => {
      try {
        const res = await api.get("/employees/allowance-types/");
        setAllowanceTypes(res.data);

        // restore previous values when going back
        if (initialValues?.length) {
          setSubmittedAllowances(
            initialValues.map((a) => ({
              allowance_type:
                typeof a.allowance_type === "object" && a.allowance_type !== null
                  ? (a.allowance_type as { id: number }).id
                  : a.allowance_type,
              amount: a.amount,
              frequency: a.frequency,
              effective_from: a.effective_from,
              status: a.status || "Active",
            }))
          );
        } else {
          setSubmittedAllowances([]);
        }
      } catch {
        message.error("Failed to load allowance types");
      }
    };

    loadAllowanceTypes();
  }, [open]);

  // ✅ Add allowance
  const handleAdd = (values: any) => {
    const exists = submittedAllowances.some(
      (a) => a.allowance_type === values.allowance_type
    );

    if (exists) {
      message.warning("This allowance type is already added.");
      return;
    }

    const newAllowance: AllowanceItem = {
      allowance_type: values.allowance_type,
      amount: values.amount,
      frequency: values.frequency,
      effective_from: values.effective_from.format("YYYY-MM-DD"),
      status: "Active",
    };

    setSubmittedAllowances([...submittedAllowances, newAllowance]);
    form.resetFields();
  };

  // ✅ Remove allowance
  const handleRemove = (typeId: number) => {
    setSubmittedAllowances(
      submittedAllowances.filter((a) => a.allowance_type !== typeId)
    );
  };

  // ✅ Next step
  const handleNext = () => {
    onNext(submittedAllowances);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Add Allowances"
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={handleAdd}>
        <Form.Item
          name="allowance_type"
          label="Allowance Type"
          rules={[{ required: true }]}
        >
          <Select placeholder="Select allowance">
            {allowanceTypes.map((a) => (
              <Select.Option key={a.id} value={a.id}>
                {a.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Amount"
          rules={[{ required: true }]}
        >
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        <Form.Item
          name="frequency"
          label="Frequency"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="Monthly">Monthly</Select.Option>
            <Select.Option value="Per Period">Per Period</Select.Option>
            <Select.Option value="One Time">One Time</Select.Option>
            <Select.Option value="Per Day">Per Day</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button type="primary" htmlType="submit" block>
          Add Allowance
        </Button>
      </Form>

      <List
        style={{ marginTop: 20 }}
        bordered
        dataSource={submittedAllowances}
        renderItem={(item) => {
          const type = allowanceTypes.find(
            (t) => t.id === item.allowance_type
          );

          return (
            <List.Item
              actions={[
                <Button
                  danger
                  type="link"
                  onClick={() => handleRemove(item.allowance_type)}
                >
                  Remove
                </Button>,
              ]}
            >
              <div>
                <strong>{type?.name}</strong> — {item.amount} (
                {item.frequency}) <br />
                Effective: {item.effective_from}
              </div>
            </List.Item>
          );
        }}
      />

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Button onClick={onBack}>Back</Button>
        <Button type="primary" onClick={handleNext}>
          Next
        </Button>
      </div>
    </Modal>
  );
}