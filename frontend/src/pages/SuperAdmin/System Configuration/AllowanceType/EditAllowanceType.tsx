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
      setDirty(false);
    }
  }, [allowance, open, form]);

  const submit = async () => {
    try {
      const values = await form.validateFields();

      if (!dirty) {
        message.info("No changes to update");
        return;
      }

      const nextIsActive = toBool(values.is_active);
      const prevIsActive = toBool(allowance?.is_active);

      const proceedUpdate = async () => {
        await api.patch(`/approvals/allowance-type/${allowance.id}/`, {
          name: values.name,
          code: values.code,
          is_active: nextIsActive,
        });

        message.success("Allowance type updated");
        onClose();
        refresh();
      };

      // ✅ confirm ONLY when deactivating (Active -> Inactive)
      const isDeactivating = prevIsActive === true && nextIsActive === false;

      if (isDeactivating) {
        Modal.confirm({
          title: "Deactivate Allowance Type?",
          content: "Are you sure you want to deactivate this allowance type?",
          okText: "Yes, Deactivate",
          okType: "danger",
          cancelText: "Cancel",
          onOk: proceedUpdate,
        });
        return;
      }

      // normal update (activate or edit fields)
      await proceedUpdate();
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
        onValuesChange={() => setDirty(true)}
      >
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Code" name="code" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item
          label={
            <Tooltip title="Toggle to activate or deactivate this allowance type">
              <span>Active</span>
            </Tooltip>
          }
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
