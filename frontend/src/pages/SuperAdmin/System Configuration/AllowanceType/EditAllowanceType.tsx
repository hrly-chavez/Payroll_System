import { Modal, Form, Input, Switch, message, Tooltip } from "antd";
import { useEffect, useState } from "react";
import api from "../../../../api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
  allowance: any;
  refresh: () => void;
};

const toBool = (v: any) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return Boolean(v);
};

const EditAllowanceType = ({ open, onClose, allowance, refresh }: Props) => {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (allowance && open) {
      form.setFieldsValue({
        name: allowance.name ?? "",
        code: allowance.code ?? "",
        is_active: toBool(allowance.is_active),
      });

      // ✅ reset "changed" flag whenever we load a record
      setDirty(false);
    }
  }, [allowance, open, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();

      // ✅ Reliable: if user didn't change anything
      if (!dirty) {
        message.info("No changes to update");
        return;
      }

      await api.patch(`/approvals/allowance-type/${allowance.id}/`, {
        name: values.name,
        code: values.code,
        is_active: toBool(values.is_active),
      });

      message.success("Allowance type updated");
      onClose();
      refresh();
    } catch (err: any) {
      const data = err?.response?.data;

      const backendMsg =
        (Array.isArray(data?.code) && data.code[0]) ||
        (Array.isArray(data?.name) && data.name[0]) ||
        data?.detail ||
        "Failed to update allowance type";

      message.error(backendMsg);
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
      <Form
        form={form}
        layout="vertical"
        // ✅ mark as changed on ANY update (including switch)
        onValuesChange={() => setDirty(true)}
      >
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Code" name="code" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Active" name="is_active" valuePropName="checked">
          <Tooltip title="Toggle to activate or deactivate this allowance type">
            <Switch />
          </Tooltip>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditAllowanceType;
