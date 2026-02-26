import React, { useEffect, useMemo, useState } from "react";
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
  const [submittedAllowances, setSubmittedAllowances] = useState<AllowanceItem[]>(
    []
  );

  // 🔒 Strict numeric blockers: prevent letters & special chars (type + paste)
  const blockNonNumeric = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const allowedNav = [
      "Backspace",
      "Delete",
      "Tab",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ];
    if (allowedNav.includes(e.key)) return;

    const isDigit = /^[0-9]$/.test(e.key);
    const isDot = e.key === ".";

    const input = e.currentTarget;
    const current = input.value || "";

    if (!isDigit && !isDot) {
      e.preventDefault();
      return;
    }

    // allow only ONE dot
    if (isDot && current.includes(".")) {
      e.preventDefault();
    }
  };

  const blockBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    const data = native.data;
    if (!data) return;

    if (!/^[0-9.]$/.test(data)) {
      native.preventDefault();
      return;
    }

    const input = e.currentTarget as HTMLInputElement;
    if (data === "." && input.value.includes(".")) {
      native.preventDefault();
    }
  };

  const blockPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text") ?? "";
    if (!/^\d*\.?\d*$/.test(text.trim())) {
      e.preventDefault();
    }
  };

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
                  : (a.allowance_type as number),
              amount: a.amount,
              frequency: a.frequency,
              effective_from: a.effective_from,
              status: a.status || "Active",
            }))
          );
        } else {
          setSubmittedAllowances([]);
        }

        // optional: reset form every open
        form.resetFields();
      } catch {
        message.error("Failed to load allowance types");
      }
    };

    loadAllowanceTypes();
  }, [open, initialValues, form]);

  // ✅ build a quick lookup set of already-added types
  const addedTypeIds = useMemo(() => {
    return new Set(submittedAllowances.map((a) => a.allowance_type));
  }, [submittedAllowances]);

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

    setSubmittedAllowances((prev) => [...prev, newAllowance]);
    form.resetFields();
  };

  // ✅ Remove allowance
  const handleRemove = (typeId: number) => {
    setSubmittedAllowances((prev) => prev.filter((a) => a.allowance_type !== typeId));
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
          rules={[{ required: true, message: "Please select an allowance type" }]}
        >
          <Select placeholder="Select allowance" showSearch optionFilterProp="children">
            {allowanceTypes.map((a) => {
              const isDisabled = addedTypeIds.has(a.id);
              return (
                <Select.Option key={a.id} value={a.id} disabled={isDisabled}>
                  {a.name}
                  {isDisabled ? " (Already added)" : ""}
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Amount"
          rules={[
            { required: true, message: "Amount is required" },
            {
              validator: (_, value) => {
                if (value === undefined || value === null) return Promise.resolve();
                if (value < 0) return Promise.reject("Amount cannot be negative");
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            precision={2}
            controls={false}
            inputMode="decimal"
            onKeyDown={blockNonNumeric}
            onBeforeInput={blockBeforeInput}
            onPaste={blockPaste}
          />
        </Form.Item>

        <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
          <Select>
            <Select.Option value="Monthly">Monthly</Select.Option>
            <Select.Option value="Per Period">Per Period</Select.Option>
            <Select.Option value="One Time">One Time</Select.Option>
            <Select.Option value="Per Day">Per Day</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="effective_from" label="Effective From" rules={[{ required: true }]}>
          <DatePicker
            style={{ width: "100%" }}
            disabledDate={(current) => current && current < dayjs().startOf("day")}
          />
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
          const type = allowanceTypes.find((t) => t.id === item.allowance_type);

          return (
            <List.Item
              actions={[
                <Button
                  key="remove"
                  danger
                  type="link"
                  onClick={() => handleRemove(item.allowance_type)}
                >
                  Remove
                </Button>,
              ]}
            >
              <div>
                <strong>{type?.name}</strong> — {item.amount} ({item.frequency}) <br />
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