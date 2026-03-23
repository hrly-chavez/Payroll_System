//src/pages/SuperAdmin/Request/LoanDeclineModal.tsx

import React, { useEffect } from "react";
import { Modal, Form, Input } from "antd";

const { TextArea } = Input;

interface LoanDeclineModalProps {
  open: boolean;
  loading?: boolean;
  requestType?: "Loan" | "Holiday" | "Leave";
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}

const LoanDeclineModal: React.FC<LoanDeclineModalProps> = ({
  open,
  loading = false,
  requestType = "Loan",
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values.decline_reason.trim());
      form.resetFields();
    } catch (error) {
      // validation error handled by antd form
      console.error(error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={`Decline ${requestType} Request`}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Submit Decline"
      cancelText="Cancel"
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Decline Reason"
          name="decline_reason"
          rules={[
            { required: true, message: "Please enter the decline reason." },
            { min: 3, message: "Decline reason must be at least 3 characters." },
            { max: 500, message: "Decline reason must not exceed 500 characters." },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Enter the reason for declining this request..."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LoanDeclineModal;