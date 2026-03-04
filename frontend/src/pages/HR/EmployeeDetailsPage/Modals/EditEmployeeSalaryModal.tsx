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

  // Fetch latest salary on open
  useEffect(() => {
    if (!open) return;

    const fetchLatest = async () => {
      try {
        const res = await api.get(
          `/employees/salaries/latest?employee=${employeeId}`
        );

        setExistingSalary(res.data);

        form.setFieldsValue({
          pay_type: res.data.pay_type,
          base_rate: res.data.base_rate,
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
  }, [open, employeeId, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (existingSalary) {
        // 🔥 1️⃣ Update salary
        await api.post("/employees/salaries/edit/", {
          employee: employeeId,
          pay_type: values.pay_type,
          base_rate: values.base_rate,
          effective_from: values.effective_from.format("YYYY-MM-DD"),
          reason: values.reason,
        });

        message.success("Salary updated successfully");

        // 🔥 2️⃣ Fetch current active deductions
        const deductionsRes = await api.get(
          `/employees/deductions/?employee=${employeeId}`
        );

        setInitialDeductions(deductionsRes.data);
        setNewSalaryBase(values.base_rate);

        // 🔥 3️⃣ Open contributions modal
        setContributionsOpen(true);

      } else {
        // 🔥 First salary creation
        const res = await api.post("/employees/salaries/", {
          employee: employeeId,
          pay_type: values.pay_type,
          base_rate: values.base_rate,
          effective_from: values.effective_from.format("YYYY-MM-DD"),
          reason: values.reason,
        });

        message.success("Salary saved successfully");

        setNewSalaryBase(res.data.base_rate);
        setInitialDeductions([]);
        setContributionsOpen(true);
      }

    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save salary");
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
          <Form.Item
            name="pay_type"
            label="Pay Type"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: "Monthly", value: "Monthly" },
                { label: "Daily", value: "Daily" },
                { label: "Hourly", value: "Hourly" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="base_rate"
            label="Base Rate"
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item
            name="effective_from"
            label="Effective From"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label="Reason for Change"
            name="reason"
            rules={[
              { required: true, message: "Please provide a reason for this change" },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Why are you making these changes?"
            />
          </Form.Item>

          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Save Salary
          </Button>
        </Form>
      </Modal>

      {/* 🔥 Contributions Modal (for BOTH create & edit) */}
      {newSalaryBase !== null && (
        <EditEmployeeContributionsModal
          open={contributionsOpen}
          salaryBase={newSalaryBase}
          employeeId={employeeId}
          initialValues={initialDeductions}
          onBack={() => setContributionsOpen(false)}
          onClose={() => setContributionsOpen(false)}
          onNext={async (deductions: any[]) => {
            try {
              await api.post("/employees/deductions/replace/", {
                employee: employeeId,
                deductions: deductions,
              });

              message.success("Contributions updated successfully");

              setContributionsOpen(false);
              onSuccess();
              onClose();

            } catch (err: any) {
              message.error(
                err.response?.data?.detail ||
                "Failed to save contributions"
              );
            }
          }}
        />
      )}
    </>
  );
};

export default EditEmployeeSalaryModal;