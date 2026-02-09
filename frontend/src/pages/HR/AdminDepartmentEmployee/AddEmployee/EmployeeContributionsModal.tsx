import {
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Button,
  message,
  Divider
} from "antd";
import { useEffect, useState } from "react";
import api from "api/axios";

interface Props {
  open: boolean;
  employeeId: number;
  onNext: () => void;
  onClose: () => void;
}


const EmployeeContributionsModal: React.FC<Props> = ({
  open,
  employeeId,
  onNext,
  onClose,
}) => {
  const [form] = Form.useForm();

  const [salary, setSalary] = useState<number>(0);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);

  //checkbox
  const [enabledDeductions, setEnabledDeductions] = useState<number[]>([]);



  /* -------------------- LOAD SALARY + DEDUCTIONS -------------------- */
  useEffect(() => {
    if (!open) return;

    const load = async () => {
      try {
        const [salaryRes, deductionRes] = await Promise.all([
          api.get(`/employees/salaries/latest/?employee=${employeeId}`),
          api.get("/employees/deductions/deduction-types"),
        ]);

        const baseSalary = Number(salaryRes.data.base_rate);
        setSalary(baseSalary);

        const computed = deductionRes.data.map((d: any) => {
          let computed_amount = 0;

          if (d.calculation_type === "Fixed") {
            computed_amount = Number(d.amount);
          } else if (d.calculation_type === "Percent") {
            computed_amount = baseSalary * (Number(d.amount) / 100);
          }

          return {
            ...d,
            computed_amount: Number(computed_amount.toFixed(2)),
          };
        });

        setDeductionTypes(computed);

        setEnabledDeductions(computed.map((d: any) => d.id));

      } catch {
        message.error("Failed to load salary or deductions");
      }
    };

    load();
  }, [open, employeeId]);


  /* -------------------- SUBMIT -------------------- */
  const submit = async () => {
    try {
      const values = await form.validateFields();

      const effectiveFrom = values.effective_from.format("YYYY-MM-DD");

      // Payload for mandatory deductions with editable amounts
      const systemPayloads = deductionTypes
        .filter(d => enabledDeductions.includes(d.id))
        .map(d => ({
          employee: employeeId,
          deduction_type: d.id,
          frequency: "Monthly",
          effective_from: effectiveFrom,
          status: "Active",
        }));


      // Submit all together
      await Promise.all(
        systemPayloads.map(p => api.post("/employees/deductions/", p))
      );


      message.success("Employee contributions saved");
      onNext();
    } catch {
      message.error("Failed to save contributions");
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
        {/* ---------------- GOVERNMENT CONTRIBUTIONS ---------------- */}
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

        {/* ---------------- EFFECTIVE DATE ---------------- */}
        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button type="primary" block onClick={submit}>
          Save Contributions
        </Button>
      </Form>
    </Modal>
  );
};

export default EmployeeContributionsModal;
