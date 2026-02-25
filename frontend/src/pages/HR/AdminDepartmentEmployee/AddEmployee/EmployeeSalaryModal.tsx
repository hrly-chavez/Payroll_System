import { Modal, Form, Select, InputNumber, DatePicker, Button, message } from "antd";
import api from "api/axios";
import { useState, useEffect} from "react";
import dayjs from "dayjs";


interface Props {
  open: boolean;
  onNext: (data: any) => void;
  onBack: () => void;
  onClose: () => void;
  initialValues?: any;
}

const EmployeeSalaryModal: React.FC<Props> = ({ open, onBack, onNext, onClose, initialValues }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && initialValues) {
      form.setFieldsValue({
        ...initialValues,
        effective_from: initialValues.effective_from ? dayjs(initialValues.effective_from) : undefined
      });
    }
  }, [open, initialValues]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const formatted = {
        pay_type: values.pay_type,
        base_rate: values.base_rate,
        effective_from: values.effective_from.format("YYYY-MM-DD"),
      };

      onNext(formatted);
    } catch {
      message.error("Please complete required fields");
    }
  };

  return (
    <Modal open={open} title="Employee Salary" onCancel={onClose} footer={null} closable={false}>
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

        <Form.Item
          name="base_rate"
          label="Base Rate"
          rules={[
            { required: true, message: "Base rate is required" },
            {
              validator: (_, value) => {
                if (value === undefined || value === null) {
                  return Promise.resolve();
                }
                if (value <= 0) {
                  return Promise.reject("Base rate must be greater than 0");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            style={{ width: "100%" }}
            min={0}
            precision={2}     // allow 2 decimal places
            stringMode={false}
          />
        </Form.Item>

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
          <Button type="primary" block onClick={handleSubmit}>
            Next
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default EmployeeSalaryModal;
