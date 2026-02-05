"use client";
//frontend/src/pages/Calendar/AddHolidayModal.tsx
import { Modal, Form, Input, DatePicker, Select, Button } from "antd";
import dayjs from "dayjs";
import { message } from "antd";
import api from "../../../api/axios";


interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddHolidayModal({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();

  const handleSubmit = async (values: any) => {
  try {
    await api.post("/approvals/holidays/create/", {
      name: values.name,
      date: values.date.format("YYYY-MM-DD"),
      type: values.type,
      base: values.base,
      remarks: values.remarks || "",
    });

    message.success("Holiday request submitted");
    form.resetFields();
    onClose();
    onSuccess();
  } catch (err: any) {
  console.log("SERVER ERROR:", err.response?.data);
  message.error("Failed to submit holiday request");
}
};


  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Add Holiday">
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item name="date" label="Date" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="type" label="Holiday Type" rules={[{ required: true }]}>
        <Select>
            <Select.Option value="Regular">Regular</Select.Option>
            <Select.Option value="Special Non-Working">Special Non-Working</Select.Option>
            <Select.Option value="Special Working">Special Working</Select.Option>
            <Select.Option value="Company Holiday">Company Holiday</Select.Option>
        </Select>
        </Form.Item>

        <Form.Item name="base" label="Holiday Base" rules={[{ required: true }]}>
        <Select>
            <Select.Option value="PH">Philippines</Select.Option>
            <Select.Option value="US">United States</Select.Option>
            <Select.Option value="COMPANY">Company</Select.Option>
        </Select>
        </Form.Item>

        <Form.Item name="remarks" label="Remarks">
        <Input.TextArea rows={3} />
        </Form.Item>

        <Button type="primary" htmlType="submit" block>
          Submit
        </Button>
      </Form>
    </Modal>
  );
}
