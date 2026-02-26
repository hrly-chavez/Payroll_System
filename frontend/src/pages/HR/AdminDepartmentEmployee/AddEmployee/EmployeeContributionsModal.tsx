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
import { useEffect, useState } from "react";
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

  // preload values when editing
  useEffect(() => {
    if (open && initialValues?.length) {
      // Enable those previously saved
      setEnabledDeductions(initialValues.map((d) => d.deduction_type));

      // Pre-fill system_deductions (by matching to deductionTypes later)
      const effectiveFrom = initialValues[0]?.effective_from
        ? dayjs(initialValues[0].effective_from)
        : undefined;

      form.setFieldsValue({
        effective_from: effectiveFrom,
      });
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

        // ✅ enable mandatory by default + also enable existing saved deductions (edit mode)
        const mandatoryIds = computed
          .filter((d: any) => MANDATORY_DEDUCTIONS.includes(d.code))
          .map((d: any) => d.id);

        const initialEnabledIds = initialValues?.length
          ? initialValues.map((x) => x.deduction_type)
          : [];

        setEnabledDeductions(Array.from(new Set([...mandatoryIds, ...initialEnabledIds])));

        // ✅ map initialValues into the correct indexes (important!)
        if (initialValues?.length) {
          const indexed: any[] = new Array(computed.length).fill(null).map(() => ({
            amount: undefined,
            frequency: undefined,
          }));

          for (const saved of initialValues) {
            const idx = computed.findIndex((d: any) => d.id === saved.deduction_type);
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

  /* -------------------- SUBMIT -------------------- */
  const submit = async () => {
    try {
      const values = form.getFieldsValue();

      if (!values.effective_from) {
        throw new Error("Please select Effective From date");
      }

      const deductions = deductionTypes
        .map((d, index) => {
          const isMandatory = MANDATORY_DEDUCTIONS.includes(d.code);
          const isEnabled = isMandatory || enabledDeductions.includes(d.id);

          // optional but not enabled → skip
          if (!isEnabled) return null;

          const amount = values.system_deductions?.[index]?.amount;
          const frequency = values.system_deductions?.[index]?.frequency;

          // mandatory always required
          if (isMandatory && (amount === undefined || frequency === undefined)) {
            throw new Error(`Please complete amount and frequency for ${d.code}`);
          }

          // optional required only when enabled
          if (!isMandatory && (amount === undefined || frequency === undefined)) {
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

  const enableOptional = (id: number) => {
    setEnabledDeductions((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const removeOptional = (id: number, index: number) => {
    setEnabledDeductions((prev) => prev.filter((x) => x !== id));
    // ✅ clear values so it won't submit or look filled later
    form.setFieldValue(["system_deductions", index, "amount"], undefined);
    form.setFieldValue(["system_deductions", index, "frequency"], undefined);
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
          const isMandatory = MANDATORY_DEDUCTIONS.includes(d.code);
          const isEnabled = isMandatory || enabledDeductions.includes(d.id);

          const calcType = String(d.calculation_type || "");
          const isFixed = calcType.toLowerCase() === "fixed";
          const isPercent = calcType.toLowerCase() === "percent";

          // ✅ OPTIONAL NOT ADDED YET: show only title + Add
          if (!isMandatory && !isEnabled) {
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

          // ✅ Mandatory OR Enabled Optional: show inputs
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
                    required: isEnabled, // if shown, must be filled
                    message: `Please enter amount for ${d.code}`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={0.01}
                  // ✅ Fixed should not be editable
                  disabled={isFixed}
                  // Optional: show % for percent type
                  addonAfter={isPercent ? "%" : undefined}
                />
              </Form.Item>

              <Form.Item
                name={["system_deductions", index, "frequency"]}
                label="Frequency"
                rules={[
                  {
                    required: isEnabled,
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

              {!isMandatory && (
                <Button type="link" danger onClick={() => removeOptional(d.id, index)}>
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