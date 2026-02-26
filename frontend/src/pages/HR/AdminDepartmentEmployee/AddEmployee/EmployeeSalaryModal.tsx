import React, { useEffect, useState } from "react";
import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import dayjs from "dayjs";

interface Props {
  open: boolean;
  onNext: (data: any) => void;
  onBack: () => void;
  onClose: () => void;
  initialValues?: any;
}

const EmployeeSalaryModal: React.FC<Props> = ({
  open,
  onBack,
  onNext,
  onClose,
  initialValues,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // ✅ Strict blockers: prevent typing/pasting letters & special chars
  const blockNonNumeric = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // allow shortcuts (copy/paste/select all/etc)
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

    // block everything else (letters, special chars, spaces, etc)
    if (!isDigit && !isDot) {
      e.preventDefault();
      return;
    }

    // allow only ONE dot
    if (isDot && current.includes(".")) {
      e.preventDefault();
      return;
    }
  };

  const blockBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    // for mobile/IME input; prevent non digit/dot from entering
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
    // allow only digits + optional one dot
    if (!/^\d*\.?\d*$/.test(text.trim())) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        ...initialValues,
        effective_from: initialValues.effective_from
          ? dayjs(initialValues.effective_from)
          : undefined,
      });
    }
  }, [open, initialValues, form]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const formatted = {
        pay_type: values.pay_type,
        base_rate: values.base_rate,
        effective_from: values.effective_from.format("YYYY-MM-DD"),
      };

      onNext(formatted);
    } catch {
      message.error("Please complete required fields");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Employee Salary"
      onCancel={onClose}
      footer={null}
      closable={false}
      confirmLoading={loading}
    >
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

        <Form.Item
          name="base_rate"
          label="Base Rate"
          rules={[
            { required: true, message: "Base rate is required" },
            {
              validator: (_, value) => {
                if (value === undefined || value === null) return Promise.resolve();
                if (value <= 0) return Promise.reject("Base rate must be greater than 0");
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0.01}
            precision={2}
            controls={false}
            inputMode="decimal"
            // ✅ block letters/specials from being typed/pasted
            onKeyDown={blockNonNumeric}
            onBeforeInput={blockBeforeInput}
            onPaste={blockPaste}
          />
        </Form.Item>

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            disabledDate={(current) => current && current < dayjs().startOf("day")}
          />
        </Form.Item>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={onBack} block disabled={loading}>
            Back
          </Button>
          <Button type="primary" block onClick={handleSubmit} loading={loading}>
            Next
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EmployeeSalaryModal;