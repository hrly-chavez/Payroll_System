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
      const values = await form.validateFields();
      const effectiveFrom = values.effective_from.format("YYYY-MM-DD");

      const deductions = deductionTypes
        .filter(d => enabledDeductions.includes(d.id))
        .map((d, index) => {
          const amount = form.getFieldValue(["system_deductions", index, "amount"]);
          const frequency = form.getFieldValue(["system_deductions", index, "frequency"]);

          return {
            deduction_type: d.id,
            amount,
            frequency,
            effective_from: effectiveFrom,
            status: "Active",
          };
        });

      onNext(deductions);
    } catch {
      message.error("Please complete required fields");
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
          const isEnabled = enabledDeductions.includes(d.id);

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
                rules={
                  isEnabled
                    ? [{ required: true, message: "Please enter amount" }]
                    : []
                }
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={0.01}
                  disabled={!isEnabled}
                />
              </Form.Item>

              {/* Frequency Select */}
              <Form.Item
                name={["system_deductions", index, "frequency"]}
                label="Frequency"
                initialValue={d.frequency}
                rules={isEnabled ? [{ required: true, message: "Please select frequency" }] : []}
              >
                <Select disabled={!isEnabled} style={{ width: "100%" }}>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Per Period">Per Period</Option>
                  <Option value="One Time">One Time</Option>
                </Select>
              </Form.Item>

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
