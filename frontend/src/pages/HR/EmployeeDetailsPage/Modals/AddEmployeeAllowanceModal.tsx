import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Button,
  message,
} from "antd";
import { useEffect, useState } from "react";
import api from "../../../../api/axios";
import dayjs from "dayjs";

interface ExistingAllowance {
  allowance_type_id: number;
}

interface Props {
  open: boolean;
  employeeId: number;
  existingAllowances: ExistingAllowance[];
  onClose: () => void;
  onSuccess: () => void;
}


const AddEmployeeAllowanceModal: React.FC<Props> = ({
  open,
  employeeId,
  existingAllowances,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // resetting the forms
  const handleCancel = () => {
    form.resetFields();   // clear all inputs
    onClose();            // close modal
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open]);

  /* =========================
     LOAD ALLOWANCE TYPES
  ========================== */
  useEffect(() => {
    if (!open) return;

    const fetchTypes = async () => {
      try {
        const res = await api.get("/employees/allowance-types/");
        setAllowanceTypes(res.data);
      } catch {
        message.error("Failed to load allowance types");
      }
    };

    fetchTypes();
  }, [open]);

  /* =========================
     SUBMIT
  ========================== */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        employee: employeeId,
        allowance_type_id: values.allowance_type,
        amount: values.amount,
        frequency: values.frequency,
        effective_from: values.effective_from.format("YYYY-MM-DD"),
        status: "Active",
      };

      await api.post("/employees/allowances/", payload);

      message.success("Allowance added successfully");
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Failed to add allowance");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     CHECKING ALLOWANCES
  ========================== */
  const assignedTypeIds = existingAllowances.map(
    (a) => a.allowance_type_id
  );

  const availableAllowanceTypes = allowanceTypes.filter(
    (type) => !assignedTypeIds.includes(type.id)
  );


  return (
    <Modal
      open={open}
      title="Add Employee Allowance"
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item
          name="allowance_type"
          label="Allowance Type"
          rules={[{ required: true, message: "Please select allowance type" }]}
        >
          <Select
            placeholder="Select allowance type"
            options={availableAllowanceTypes.map((a) => ({
              label: a.name,
              value: a.id,
            }))}  

          />
        </Form.Item>

        <Form.Item
          name="amount"
          label="Amount"
          rules={[{ required: true, message: "Enter amount" }]}
        >
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          name="frequency"
          label="Frequency"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: "Monthly", value: "Monthly" },
              { label: "Per Period", value: "Per Period" },
              { label: "One Time", value: "One Time" },
              { label: "Per Day", value: "Per Day" },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button
          type="primary"
          block
          loading={loading}
          disabled={availableAllowanceTypes.length === 0}
          onClick={handleSubmit}
        >
          Save Allowance
        </Button>

        {availableAllowanceTypes.length === 0 && (
          <p style={{ color: "gray", marginTop: 8 }}>
            All allowance types are already assigned to this employee.
          </p>
        )}

      </Form>
    </Modal>
  );
};

export default AddEmployeeAllowanceModal;
