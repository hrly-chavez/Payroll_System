import { Modal, Form, Input, Switch, message } from "antd";
import { useEffect } from "react";
import api from "../../../../api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
  allowance: any;
  refresh: () => void;
};

const EditAllowanceType = ({
  open,
  onClose,
  allowance,
  refresh,
}: Props) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (allowance) {
      form.setFieldsValue(allowance);
    }
  }, [allowance, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();

      await api.put(
        `/approvals/allowance-type/${allowance.id}/`,
        values
      );

      message.success("Allowance type updated");

      onClose();
      refresh();
    } catch (err: any) {
      message.error(
        err?.response?.data?.code ||
          "Failed to update allowance type"
      );
    }
  };
  
  return (
    <Modal
      open={open}
      title="Edit Allowance Type"
      onCancel={onClose}
      onOk={submit}
      okText="Update"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Code"
          name="code"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Active"
          name="is_active"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAllowanceType;
