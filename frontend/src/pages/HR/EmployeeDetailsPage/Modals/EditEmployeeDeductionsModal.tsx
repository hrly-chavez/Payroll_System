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
import React, { useEffect, useState, useRef } from "react";
import api from "../../../../api/axios";
import dayjs from "dayjs";

const { Option } = Select;

interface Props {
  open: boolean;
  salaryBase: number;
  payType: string;
  employeeId: number;
  onNext: (deductions: any[]) => void; // pass selected deductions back
  onBack: () => void;
  onClose: () => void;
  initialValues?: any[]; // existing contributions if editing
}

const MANDATORY_DEDUCTIONS = ["SSS", "PHILHEALTH", "PAGIBIG"];

const EditEmployeeContributionsModal: React.FC<Props> = ({
  open,
  salaryBase,
  payType,
  employeeId,
  onBack,
  onNext,
  onClose,
  initialValues,
}) => {
  const [form] = Form.useForm();
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [enabledDeductions, setEnabledDeductions] = useState<number[]>([]);
  const [divisor, setDivisor] = useState(22); // fallback
  const loadedRef = useRef(false);

  const isMandatoryCode = (code: any) =>
    MANDATORY_DEDUCTIONS.includes(String(code || "").toUpperCase());

  // Fetch payroll settings once
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get("/employees/settings/");
        if (res.data.daily_rate_divisor) setDivisor(res.data.daily_rate_divisor);
      } catch (err) {
        console.error("Failed to fetch payroll settings", err);
      }
    };
    fetchSettings();
  }, []);

  // Convert salary to monthly
  const getMonthlySalary = (base: number, type: string) => {
    if (!base) return 0;
    if (type === "Monthly") return base;
    if (type === "Daily") return base * divisor;
    if (type === "Hourly") return base * 8 * divisor;
    return base;
  };

  const monthlySalary = getMonthlySalary(salaryBase, payType);

  // load deduction types
  useEffect(() => {
    if (!open) {
      loadedRef.current = false;
      return;
    }

    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      try {
        const res = await api.get(
          `/employees/deductions/deduction-types?salary=${monthlySalary}`
        );

        const computed = res.data.map((d: any) => ({
          ...d,
          computed_amount: Number(d.amount),
        }));
        setDeductionTypes(computed);

        const mandatoryIds = computed
          .filter((d: any) => isMandatoryCode(d.code))
          .map((d: any) => d.id);

        const initialEnabledIds = initialValues?.length
          ? initialValues.map((x) => x.deduction_type)
          : [];

        setEnabledDeductions(Array.from(new Set([...mandatoryIds, ...initialEnabledIds])));

        // Map initialValues into correct indexes, pre-filling mandatory deductions only
        const indexed: any[] = computed.map((d: any) => {
          const saved = initialValues?.find((x) => x.deduction_type === d.id);
          const mandatory = isMandatoryCode(d.code);

          return {
            amount: saved?.amount ?? (mandatory ? d.computed_amount : undefined),
            frequency: saved?.frequency ?? (mandatory ? "Per Period" : undefined),
          };
        });

        form.setFieldsValue({ system_deductions: indexed });
      } catch {
        message.error("Failed to load deductions");
      }
    };

    load();
  }, [open, monthlySalary, initialValues, form]);

  const enableOptional = (id: number) => {
    if (!enabledDeductions.includes(id)) setEnabledDeductions((prev) => [...prev, id]);
  };

  const removeOptional = (id: number, index: number) => {
    setEnabledDeductions((prev) => prev.filter((x) => x !== id));
    form.setFieldValue(["system_deductions", index, "amount"], undefined);
    form.setFieldValue(["system_deductions", index, "frequency"], undefined);
  };

  const submit = async () => {
    try {
      const values = form.getFieldsValue();
      if (!values.effective_from) throw new Error("Please select Effective From date");

      const deductions = deductionTypes
        .map((d, index) => {
          const mandatory = isMandatoryCode(d.code);
          const enabled = mandatory || enabledDeductions.includes(d.id);
          if (!enabled) return null;

          const amount = values.system_deductions?.[index]?.amount;
          const frequency = values.system_deductions?.[index]?.frequency;

          if (amount === undefined || frequency === undefined)
            throw new Error(`Please complete amount and frequency for ${d.code}`);

          return {
            employee: employeeId,
            deduction_type: d.id,
            amount,
            frequency,
            effective_from: values.effective_from.format("YYYY-MM-DD"),
            status: "Active",
          };
        })
        .filter(Boolean);

      // Post to backend directly
      const res = await api.post("/employees/deductions/replace/", {
        employee: employeeId,
        deductions,
      });

      message.success(res.data.detail || "Deductions updated successfully");

      // Call parent onNext if needed
      onNext(deductions);
    } catch (err: any) {
      // Extract backend errors
      let errorMsg = "Please complete required fields";

      if (err.response?.data) {
        const data = err.response.data;

        if (data.non_field_errors && data.non_field_errors.length) {
          errorMsg = data.non_field_errors.join("; ");
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (typeof data === "string") {
          errorMsg = data;
        } else {
          errorMsg = Object.entries(data)
            .map(([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : value}`
            )
            .join("; ");
        }
      } else if (err.message) {
        errorMsg = err.message;
      }

      message.error(errorMsg);
    }
  };
  return (
    <Modal
      open={open}
      title="Edit Employee Contributions"
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

          if (!mandatory && !enabled) {
            return (
              <div key={d.id} style={{ border: "1px solid #f0f0f0", padding: 12, marginBottom: 12, borderRadius: 6, background: "#fff" }}>
                <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 6 }}>
                  {d.code} ({d.calculation_type})
                </div>
                <Button type="link" onClick={() => enableOptional(d.id)}>Add</Button>
              </div>
            );
          }

          return (
            <div key={d.id} style={{ border: "1px solid #f0f0f0", padding: 12, marginBottom: 12, borderRadius: 6, background: "#fff" }}>
              <Form.Item
                name={["system_deductions", index, "amount"]}
                label={`${d.code} (${d.calculation_type})`}
                initialValue={d.computed_amount}
                rules={[{ required: true, message: `Please enter amount for ${d.code}` }]}
              >
                <InputNumber style={{ width: "100%" }} min={0} precision={2} controls={false} disabled={isFixed} />
              </Form.Item>

              <Form.Item
                name={["system_deductions", index, "frequency"]}
                label="Frequency"
                rules={[{ required: true, message: `Please select frequency for ${d.code}` }]}
              >
                <Select style={{ width: "100%" }}>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Per Period">Per Period</Option>
                  <Option value="One Time">One Time</Option>
                </Select>
              </Form.Item>

              {!mandatory && (
                <Button type="link" danger onClick={() => removeOptional(d.id, index)}>Remove</Button>
              )}
            </div>
          );
        })}

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true, message: "Please select Effective From date" }]}
        >
          <DatePicker style={{ width: "100%" }} disabledDate={(current) => current && current < dayjs().startOf("day")} />
        </Form.Item>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={onBack} block>Back</Button>
          <Button type="primary" block onClick={submit}>Save</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EditEmployeeContributionsModal;