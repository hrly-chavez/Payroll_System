import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import api from "api/axios";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

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
  salary,
  onSuccess,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  /* =========================
     PREFILL FORM ON EDIT
  ========================== */
  useEffect(() => {
    if (open && salary) {
      form.setFieldsValue({
        pay_type: salary.pay_type,
        base_rate: salary.base_rate,
        effective_from: dayjs(salary.effective_from),
      });
    }

    if (!open) {
      form.resetFields();
    }
  }, [open, salary]);

  /* =========================
     SUBMIT
  ========================== */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await api.post("/employees/salaries/edit/", {
        employee: employeeId,
        pay_type: values.pay_type,
        base_rate: values.base_rate,
        effective_from: values.effective_from.format("YYYY-MM-DD"),
      });

      message.success("Salary updated successfully");
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to save salary");
    } finally {
      setLoading(false);
    }
  };

  return (
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
              { label: "Per Period", value: "Per Period" },
              { label: "Daily", value: "Daily" },
              { label: "Hourly", value: "Hourly" },
            ]}
          />
        </Form.Item>

        <Form.Item name="base_rate" label="Base Rate" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        <Form.Item
          name="effective_from"
          label="Effective From"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Button type="primary" block loading={loading} onClick={handleSubmit}>
          Save Salary
        </Button>
      </Form>
    </Modal>
  );
};

export default EditEmployeeSalaryModal;
