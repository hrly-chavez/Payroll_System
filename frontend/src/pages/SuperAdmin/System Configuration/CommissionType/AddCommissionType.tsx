import React, { useEffect } from "react";
import { Modal, Form, Input, Switch } from "antd";

type Props = {
  open: boolean;
  title: string;
  onCancel: () => void;
  onOk: () => void;
  form: any;
};

const AddCommissionType: React.FC<Props> = ({
  open,
  title,
  onCancel,
  onOk,
  form,
}) => {
  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [open, form]);

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={onOk}
      okText="Save"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Commission Name"
          name="name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Code"
          name="code"
          rules={[{ required: true, message: "Code is required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Taxable"
          name="is_taxable"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="Active"
          name="is_active"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddCommissionType;
