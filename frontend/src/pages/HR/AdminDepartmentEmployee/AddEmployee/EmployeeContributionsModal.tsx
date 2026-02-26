import {
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Button,
  message,
  Divider,
  Select,
} from "antd";
import React, { useEffect, useState } from "react";
import api from "api/axios";
import dayjs from "dayjs";

const { Option } = Select;

interface Props {
  open: boolean;
  salaryBase: number;
  onNext: (data: any[]) => void;
  onBack: () => void;
  onClose: () => void;
  initialValues?: any[];
}

const EmployeeContributionsModal: React.FC<Props> = ({
  open,
  salaryBase,
  onBack,
  onNext,
  onClose,
  initialValues,
}) => {
  const [form] = Form.useForm();

  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [enabledDeductions, setEnabledDeductions] = useState<number[]>([]);

  const MANDATORY_DEDUCTIONS = ["SSS", "PHILHEALTH", "PAGIBIG"];

  const isMandatoryCode = (code: any) =>
    MANDATORY_DEDUCTIONS.includes(String(code || "").toUpperCase());

  // 🔒 Strict numeric blockers (type + paste)
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

  // preload effective date when editing
  useEffect(() => {
    if (open && initialValues?.length) {
      const effectiveFrom = initialValues[0]?.effective_from
        ? dayjs(initialValues[0].effective_from)
        : undefined;

      form.setFieldsValue({ effective_from: effectiveFrom });
    }
  }, [open, initialValues, form]);

  /* -------------------- LOAD DEDUCTION TYPES -------------------- */
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const res = await api.get(
          `/employees/deductions/deduction-types?salary=${salaryBase}`
        );

        const computed = res.data.map((d: any) => ({
          ...d,
          computed_amount: Number(d.amount),
        }));

        setDeductionTypes(computed);

        // enable mandatory by default + also enable existing saved deductions (edit mode)
        const mandatoryIds = computed
          .filter((d: any) => isMandatoryCode(d.code))
          .map((d: any) => d.id);

        const initialEnabledIds = initialValues?.length
          ? initialValues.map((x) => x.deduction_type)
          : [];

        setEnabledDeductions(
          Array.from(new Set([...mandatoryIds, ...initialEnabledIds]))
        );

        // map initialValues into the correct indexes
        if (initialValues?.length) {
          const indexed: any[] = new Array(computed.length).fill(null).map(() => ({
            amount: undefined,
            frequency: undefined,
          }));

          for (const saved of initialValues) {
            const idx = computed.findIndex(
              (d: any) => d.id === saved.deduction_type
            );
            if (idx !== -1) {
              indexed[idx] = {
                amount: saved.amount,
                frequency: saved.frequency,
              };
            }
          }

          form.setFieldsValue({ system_deductions: indexed });
        } else {
          // default values for mandatory (computed amount)
          const defaults = computed.map((d: any) => ({
            amount: Number(d.amount),
            frequency: undefined,
          }));
          form.setFieldsValue({ system_deductions: defaults });
        }
      } catch {
        message.error("Failed to load deductions");
      }
    };

    load();
  }, [open, salaryBase, initialValues, form]);

  const enableOptional = (id: number) => {
    setEnabledDeductions((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeOptional = (id: number, index: number) => {
    setEnabledDeductions((prev) => prev.filter((x) => x !== id));
    form.setFieldValue(["system_deductions", index, "amount"], undefined);
    form.setFieldValue(["system_deductions", index, "frequency"], undefined);
  };

  /* -------------------- SUBMIT -------------------- */
  const submit = async () => {
    try {
      const values = form.getFieldsValue();

      if (!values.effective_from) {
        throw new Error("Please select Effective From date");
      }

      const deductions = deductionTypes
        .map((d, index) => {
          const mandatory = isMandatoryCode(d.code);
          const enabled = mandatory || enabledDeductions.includes(d.id);

          // optional but not enabled → skip
          if (!enabled) return null;

          const amount = values.system_deductions?.[index]?.amount;
          const frequency = values.system_deductions?.[index]?.frequency;

          // required when shown (mandatory OR enabled optional)
          if (amount === undefined || frequency === undefined) {
            throw new Error(`Please complete amount and frequency for ${d.code}`);
          }

          return {
            deduction_type: d.id,
            amount,
            frequency,
            effective_from: values.effective_from.format("YYYY-MM-DD"),
            status: "Active",
          };
        })
        .filter(Boolean);

      onNext(deductions as any[]);
    } catch (err: any) {
      message.error(err.message || "Please complete required fields");
    }
  };

  return (
    <Modal
      open={open}
      title="Employee Contributions"
      footer={null}
      onCancel={onClose}
      closable={false}
    >
      <Form layout="vertical" form={form}>
        <Divider>Government Contributions</Divider>

        {deductionTypes.map((d, index) => {
          const mandatory = isMandatoryCode(d.code);
          const enabled = mandatory || enabledDeductions.includes(d.id);

          const calcType = String(d.calculation_type || "");
          const isFixed = calcType.toLowerCase() === "fixed";
          const isPercent = calcType.toLowerCase() === "percent";

          // OPTIONAL not added yet: show only title + Add
          if (!mandatory && !enabled) {
            return (
              <div
                key={d.id}
                style={{
                  border: "1px solid #f0f0f0",
                  padding: 12,
                  marginBottom: 12,
                  borderRadius: 6,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 6 }}>
                  {d.code} ({d.calculation_type})
                </div>

                <Button type="link" onClick={() => enableOptional(d.id)}>
                  Add
                </Button>
              </div>
            );
          }

          // Mandatory OR Enabled Optional: show inputs
          return (
            <div
              key={d.id}
              style={{
                border: "1px solid #f0f0f0",
                padding: 12,
                marginBottom: 12,
                borderRadius: 6,
                background: "#fff",
              }}
            >
              <Form.Item
                name={["system_deductions", index, "amount"]}
                label={`${d.code} (${d.calculation_type})`}
                initialValue={d.computed_amount}
                rules={[
                  {
                    required: true,
                    message: `Please enter amount for ${d.code}`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  precision={2}
                  controls={false}
                  inputMode="decimal"
                  disabled={isFixed}
                  addonAfter={isPercent ? "%" : undefined}
                  onKeyDown={blockNonNumeric}
                  onBeforeInput={blockBeforeInput}
                  onPaste={blockPaste}
                />
              </Form.Item>

              <Form.Item
                name={["system_deductions", index, "frequency"]}
                label="Frequency"
                rules={[
                  {
                    required: true,
                    message: `Please select frequency for ${d.code}`,
                  },
                ]}
              >
                <Select style={{ width: "100%" }}>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Per Period">Per Period</Option>
                  <Option value="One Time">One Time</Option>
                </Select>
              </Form.Item>

              {!mandatory && (
                <Button
                  type="link"
                  danger
                  onClick={() => removeOptional(d.id, index)}
                >
                  Remove
                </Button>
              )}
            </div>
          );
        })}

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true, message: "Please select Effective From date" }]}
        >
          <DatePicker
            style={{ width: "100%" }}
            disabledDate={(current) => current && current < dayjs().startOf("day")}
          />
        </Form.Item>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={onBack} block>
            Back
          </Button>
          <Button type="primary" block onClick={submit}>
            Next
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EmployeeContributionsModal;