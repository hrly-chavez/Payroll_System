import React, { useEffect } from "react";
import { Modal, Form, Input, Select, DatePicker, message } from "antd";
import api from "api/axios";
import dayjs from "dayjs";

interface Props {
  open: boolean;
  allowance: any | null; // the allowance being edited
  employeeId: number;
  onClose: () => void;
  onSuccess: () => void; // callback after successful edit
}

const EditEmployeeAllowanceModal: React.FC<Props> = ({
  open,
  allowance,
  employeeId,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();

  // prefill the form when allowance changes
  useEffect(() => {
    if (allowance) {
      form.setFieldsValue({
        amount: parseFloat(
          allowance.amount.replace("₱", "").replace(/,/g, "")
        ),
        frequency: allowance.frequency,
        effective_from: dayjs(allowance.effective_from),
      });
    } else {
      form.resetFields();
    }
  }, [allowance, form]);

  const handleSubmit = async (values: any) => {
    if (!allowance) return;

    try {
        await api.post(
            `/employees/allowances/${allowance.id}/edit_allowance/`, // now allowance.id exists
            {
                amount: values.amount,
                frequency: values.frequency,
                effective_from: values.effective_from.format("YYYY-MM-DD"),
            }
            );


        message.success("Allowance updated successfully");
        onSuccess();
    } catch (error: any) {
        console.error(error);
        message.error(error.response?.data?.message || "Failed to save allowance");
    }
    };


  return (
    <Modal
      title="Edit Allowance"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Save"
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Amount"
          name="amount"
          rules={[{ required: true, message: "Please enter amount" }]}
        >
          <Input placeholder="e.g. 500" />
        </Form.Item>

        <Form.Item
          label="Frequency"
          name="frequency"
          rules={[{ required: true, message: "Please select frequency" }]}
        >
          <Select placeholder="Select frequency">
            <Select.Option value="Per Pay Period">Per Pay Period</Select.Option>
            <Select.Option value="Monthly">Monthly</Select.Option>
            <Select.Option value="One-time">One-time</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Effective From"
          name="effective_from"
          rules={[{ required: true, message: "Please select effective date" }]}
        >
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditEmployeeAllowanceModal;
