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
  salaryBase: number; // pass from salary step
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
  initialValues
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && initialValues?.length) {
      const systemDeductions = initialValues.map(d => ({
        amount: d.amount,
        frequency: d.frequency,
      }));

      // Optional: set effective_from as Dayjs
      const effectiveFrom = initialValues[0]?.effective_from
        ? dayjs(initialValues[0].effective_from)
        : undefined;

      form.setFieldsValue({
        system_deductions: systemDeductions,
        effective_from: effectiveFrom,
      });

      // enable all deductions that were previously added
      setEnabledDeductions(initialValues.map(d => d.deduction_type));
    }
  }, [open, initialValues]);

  const [salary, setSalary] = useState<number>(0);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [enabledDeductions, setEnabledDeductions] = useState<number[]>([]);

  const MANDATORY_DEDUCTIONS = ["SSS", "PHILHEALTH", "PAGIBIG"];

  /* -------------------- LOAD SALARY + DEDUCTIONS -------------------- */
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        // Get latest salary first
        setSalary(salaryBase);

        // Now send salary to backend to get correct bracket
        const deductionRes = await api.get(
          `/employees/deductions/deduction-types?salary=${salaryBase}`
        );

        const computed = deductionRes.data.map((d: any) => ({
          ...d,
          computed_amount: Number(d.amount),
          frequency: undefined, // start empty, user must choose
        }));

        setDeductionTypes(computed);
        setEnabledDeductions(computed.map((d: any) => d.id));
      } catch {
        message.error("Failed to load salary or deductions");
      }
    };

    load();
  }, [open, salaryBase]);

  /* -------------------- SUBMIT -------------------- */
  const submit = async () => {
    try {
      const values = form.getFieldsValue();

      const deductions = deductionTypes
        .filter(d => enabledDeductions.includes(d.id) || MANDATORY_DEDUCTIONS.includes(d.code))
        .map((d, index) => {
          const amount = values.system_deductions?.[index]?.amount;
          const frequency = values.system_deductions?.[index]?.frequency;

          // Only mandatory deductions must have values
          if (MANDATORY_DEDUCTIONS.includes(d.code) && (amount === undefined || frequency === undefined)) {
            throw new Error(`Please complete amount and frequency for ${d.code}`);
          }

          // skip non-mandatory deductions that are empty
          if (!MANDATORY_DEDUCTIONS.includes(d.code) && (amount === undefined || frequency === undefined)) {
            return null;
          }

          return {
            deduction_type: d.id,
            amount,
            frequency,
            effective_from: values.effective_from.format("YYYY-MM-DD"),
            status: "Active",
          };
        })
        .filter(Boolean); // remove nulls

      onNext(deductions);
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
          const isMandatory = MANDATORY_DEDUCTIONS.includes(d.code);
          const isEnabled = enabledDeductions.includes(d.id) || isMandatory;

          return (
            <div
              key={d.id}
              style={{
                border: "1px solid #f0f0f0",
                padding: 12,
                marginBottom: 12,
                borderRadius: 6,
                opacity: isEnabled ? 1 : 0.5,
              }}
            >
              {/* Amount Input */}
              <Form.Item
                name={["system_deductions", index, "amount"]}
                label={`${d.code} (${d.calculation_type})`}
                initialValue={d.computed_amount}
                rules={[
                  {
                    required: isMandatory,
                    message: `Please enter amount for ${d.code}`,
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={0.01}
                  disabled={!isEnabled && !isMandatory}
                />
              </Form.Item>

              <Form.Item
                name={["system_deductions", index, "frequency"]}
                label="Frequency"
                initialValue={d.frequency}
                rules={[
                  {
                    required: isMandatory,
                    message: `Please select frequency for ${d.code}`,
                  },
                ]}
              >
                <Select disabled={!isEnabled && !isMandatory} style={{ width: "100%" }}>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Per Period">Per Period</Option>
                  <Option value="One Time">One Time</Option>
                </Select>
              </Form.Item>

              {/* Remove button only for non-mandatory */}
              {!isMandatory && (
                <Button
                  danger={isEnabled}
                  type="link"
                  onClick={() =>
                    setEnabledDeductions(prev =>
                      isEnabled
                        ? prev.filter(id => id !== d.id)
                        : [...prev, d.id]
                    )
                  }
                >
                  {isEnabled ? "Remove" : "Add"}
                </Button>
              )}
            </div>
          );
        })}

        {/* Effective Date */}
        <Form.Item name="effective_from" label="Effective From" rules={[{ required: true }]}>
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
