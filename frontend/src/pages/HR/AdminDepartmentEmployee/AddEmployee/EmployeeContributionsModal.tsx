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

const MANDATORY_CODES = ["SSS", "PHILHEALTH", "PAGIBIG"];

const EmployeeContributionsModal: React.FC<Props> = ({
  open,
  employeeId,
  onNext,
  onClose,
}) => {
  const [form] = Form.useForm();

  const [salary, setSalary] = useState<number>(0);
  const [mandatoryDeductions, setMandatoryDeductions] = useState<any[]>([]);
  const [optionalDeductions, setOptionalDeductions] = useState<any[]>([]);

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

        const mandatory = deductionRes.data.filter((d: any) =>
          MANDATORY_CODES.includes(d.code.toUpperCase())
        );
        const optional = deductionRes.data.filter(
          (d: any) => !MANDATORY_CODES.includes(d.code)
        );

        setMandatoryDeductions(
          mandatory.map((d: any) => ({
            ...d,
            computed_amount:
              d.calculation_type === "Fixed"
                ? Number(d.amount)
                : baseSalary * (Number(d.amount) / 100),
          }))
        );

        setOptionalDeductions(optional);
      } catch (err) {
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
      const mandatoryPayloads = (values.mandatory_deductions || []).map(
        (item: any, idx: number) => ({
          employee: employeeId,
          deduction_type: mandatoryDeductions[idx].id,
          frequency: "Monthly",
          effective_from: effectiveFrom,
          status: "Active",
        })
      );

      // Optional deductions payload
      const optionalPayloads = (values.optional_deductions || []).map((d: any) => ({
        employee: employeeId,
        manual_code: d.manual_code,
        manual_calculation_type: d.manual_calculation_type,
        manual_amount: d.manual_calculation_type === "Percent"
          ? (salary * d.manual_amount) / 100 // compute percentage from base salary
          : d.manual_amount,
        frequency: "Monthly",
        effective_from: effectiveFrom,
        status: "Active",
      }));

      // Submit all together
      await Promise.all([...mandatoryPayloads, ...optionalPayloads].map(p => api.post("/employees/deductions/", p)));

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
    >
      <Form layout="vertical" form={form}>
        {/* ---------------- GOVERNMENT CONTRIBUTIONS ---------------- */}
        <Divider>Government Contributions</Divider>

        {mandatoryDeductions.map((d, index) => (
          <Form.Item
            key={d.id}
            name={["mandatory_deductions", index, "amount"]}
            label={d.code}
            initialValue={Number(d.computed_amount.toFixed(2))}
            rules={[{ required: true, message: "Please enter amount" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              step={0.01}
            />
          </Form.Item>
        ))}

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
