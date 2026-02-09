import {
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
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



      // Optional deductions payload
      const optionalPayloads = (values.optional_deductions || []).map((d: any) => ({
        employee: employeeId,
        manual_code: d.manual_code,
        manual_calculation_type: d.manual_calculation_type || "Fixed",
        manual_amount: d.manual_amount,  // 👈 send this field so serializer sees it
        frequency: "Monthly",
        effective_from: effectiveFrom,
        status: "Active",
      }));



      // Submit all together
      await Promise.all([...systemPayloads, ...optionalPayloads].map(p => api.post("/employees/deductions/", p)));

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

        {/* ---------------- OPTIONAL DEDUCTIONS ---------------- */}
        <Divider>Other Deductions</Divider>

        <Form.List name="optional_deductions">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  {/* Deduction Code / Name */}
                  <Form.Item
                    name={[name, "manual_code"]}
                    label="Code / Name"
                    rules={[{ required: true, message: "Please enter code or name" }]}
                  >
                    <Input style={{ width: "100%" }} />
                  </Form.Item>


                  {/* Calculation Type */}
                  <Form.Item
                    name={[name, "manual_calculation_type"]}
                    label="Type"
                    rules={[{ required: true, message: "Please select type" }]}
                  >
                    <Select
                      options={[
                        { label: "Fixed", value: "Fixed" },
                        { label: "Percent", value: "Percent" },
                      ]}
                    />
                  </Form.Item>

                  {/* Amount */}
                  <Form.Item
                    name={[name, "manual_amount"]}
                    label="Amount"
                    rules={[{ required: true, message: "Please enter amount" }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={0} step={0.01} />
                  </Form.Item>

                  <Button danger onClick={() => remove(name)}>Remove</Button>
                </div>
              ))}

              <Button type="dashed" onClick={() => add()} block>
                + Add Other Deduction
              </Button>
            </>
          )}
        </Form.List>

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
