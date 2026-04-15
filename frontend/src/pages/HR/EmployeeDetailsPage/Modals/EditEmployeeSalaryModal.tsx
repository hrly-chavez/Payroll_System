// src/pages/HR/EmployeeDetailPage/Modals/EditEmployeeSalaryModal.tsx
import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Button,
  message,
  Input,
} from "antd";
import api from "api/axios";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import EditEmployeeContributionsModal from "./EditEmployeeDeductionsModal";

interface Props {
  open: boolean;
  employeeId: number;
  salary?: {
    id: number;
    base_rate: number;
    pay_type: string;
    effective_from: string;
  };
  onSuccess: () => void;
  onClose: () => void;
}

const EditEmployeeSalaryModal: React.FC<Props> = ({
  open,
  employeeId,
  onSuccess,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [existingSalary, setExistingSalary] = useState<any | null>(null);
  const [contributionsOpen, setContributionsOpen] = useState(false);
  const [newSalaryBase, setNewSalaryBase] = useState<number | null>(null);
  const [initialDeductions, setInitialDeductions] = useState<any[]>([]);

  const [minWage, setMinWage] = useState<number | null>(null);
  const [divisor, setDivisor] = useState<number | null>(null);

  const payType = Form.useWatch("pay_type", form);
  const baseRate = Form.useWatch("base_rate", form);

  /*
  --------------------------------
  FETCH PAYROLL SETTINGS
  --------------------------------
  */
  useEffect(() => {
    const fetchPayrollSetting = async () => {
      try {
        const res = await api.get("/employees/settings/");

        setDivisor(res.data.daily_rate_divisor);
        setMinWage(res.data.daily_minimum_wage);
      } catch (err: any) {
        console.error("Failed to load payroll settings", err);

        message.error(
          err.response?.data?.detail || "Payroll settings not configured"
        );
      }
    };

    fetchPayrollSetting();
  }, []);

  /*
  --------------------------------
  WAGE TYPE CALCULATION
  --------------------------------
  */
  const calculateWageType = (pay_type: string, base_rate: number) => {
    if (!pay_type || !base_rate || !divisor || !minWage) return undefined;

    let monthlyEquivalent = 0;

    if (pay_type === "Monthly") {
      monthlyEquivalent = base_rate;
    } else if (pay_type === "Daily") {
      monthlyEquivalent = base_rate * divisor;
    } else if (pay_type === "Hourly") {
      monthlyEquivalent = base_rate * 8 * divisor;
    }

    const dailyEquivalent = monthlyEquivalent / divisor;

    return dailyEquivalent >= minWage
      ? "ABOVE_MINIMUM"
      : "MINIMUM";
  };

  /*
  --------------------------------
  AUTO UPDATE WAGE TYPE
  --------------------------------
  */
  useEffect(() => {
    const wageType = calculateWageType(payType, baseRate);
    if (wageType) {
      form.setFieldsValue({ wage_type: wageType });
    }
  }, [payType, baseRate, divisor, minWage]);

  // Fetch latest salary on open
  useEffect(() => {
    if (!open || !divisor || !minWage) return;

    const fetchLatest = async () => {
      try {
        const res = await api.get(
          `/employees/salaries/latest?employee=${employeeId}`
        );

        setExistingSalary(res.data);

        form.setFieldsValue({
          pay_type: res.data.pay_type,
          base_rate: res.data.base_rate,
          wage_type: calculateWageType(res.data.pay_type, res.data.base_rate),
          effective_from: dayjs(res.data.effective_from),
        });
      } catch (err: any) {
        if (err.response?.status === 404) {
          setExistingSalary(null);
        } else {
          message.error("Failed to fetch latest salary");
        }
      }
    };

    fetchLatest();
  }, [open, employeeId, divisor, minWage]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        employee: employeeId,
        pay_type: values.pay_type,
        base_rate: values.base_rate,
        wage_type: values.wage_type, // include auto-calculated wage_type
        effective_from: values.effective_from.format("YYYY-MM-DD"),
        reason: values.reason,
      };

      if (existingSalary) {
        await api.post("/employees/salaries/edit/", payload);
        message.success("Salary updated successfully");

        // Fetch current active deductions
        const deductionsRes = await api.get(
          `/employees/deductions/?employee=${employeeId}`
        );

        setInitialDeductions(deductionsRes.data);
        setNewSalaryBase(values.base_rate);
        setContributionsOpen(true);
      } else {
        const res = await api.post("/employees/salaries/", payload);
        message.success("Salary saved successfully");

        setNewSalaryBase(res.data.base_rate);
        setInitialDeductions([]);
        setContributionsOpen(true);
      }
    } catch (err: any) {
      // DRF error handling
      let errorMsg = "Failed to save salary";

      if (err.response?.data) {
        const data = err.response.data;

        if (typeof data === "string") {
          errorMsg = data;
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.non_field_errors) {
          errorMsg = data.non_field_errors.join(", ");
        } else {
          // Combine field-specific errors
          errorMsg = Object.entries(data)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
            .join("; ");
        }
      }

      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        title="Edit Base Salary"
        onCancel={onClose}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="pay_type" label="Pay Type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Monthly", value: "Monthly" },
                { label: "Daily", value: "Daily" },
                { label: "Hourly", value: "Hourly" },
              ]}
            />
          </Form.Item>

          <Form.Item name="base_rate" label="Base Rate" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item name="wage_type" label="Wage Type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "Minimum Wage", value: "MINIMUM" },
                { label: "Above Minimum Wage", value: "ABOVE_MINIMUM" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="effective_from"
            label="Effective From"
            rules={[{ required: true }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              disabledDate={(current) => {
                // Disable all dates before today
                return current && current < dayjs().startOf("day");
              }}
            />
          </Form.Item>

          <Form.Item
            label="Reason for Change"
            name="reason"
            rules={[{ required: true, message: "Please provide a reason for this change" }]}
          >
            <Input.TextArea rows={3} placeholder="Why are you making these changes?" />
          </Form.Item>

          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Save Salary
          </Button>
        </Form>
      </Modal>

      {/* Contributions Modal */}
      {newSalaryBase !== null && (
        <EditEmployeeContributionsModal
          open={contributionsOpen}
          salaryBase={newSalaryBase}
          payType={payType}
          employeeId={employeeId}
          initialValues={initialDeductions}
          onBack={() => setContributionsOpen(false)}
          onClose={() => setContributionsOpen(false)}
          // Keep onNext only to close the modal or notify parent
          onNext={(deductions: any[]) => {
            // Do NOT call API here anymore
            message.success("Contributions updated successfully");
            setContributionsOpen(false);
            onSuccess();
            onClose();
          }}
        />
      )}
    </>
  );
};

export default EditEmployeeSalaryModal;