import { Modal, Form, Input, Switch, message } from "antd";
import api from "../../../../api/axios";

type Props = {
  open: boolean;
  onClose: () => void;
  refresh: () => void;
};

const AddAllowanceType = ({ open, onClose, refresh }: Props) => {
  const [form] = Form.useForm();

  const submit = async () => {
    try {
      const values = await form.validateFields();

      await api.post("/approvals/allowance-type/add/", values);

      message.success("Allowance type added");

      form.resetFields();
      onClose();
      refresh();
    } catch (err: any) {
      const data = err?.response?.data;

      const backendMsg =
        (Array.isArray(data?.code) && data.code[0]) ||
        (Array.isArray(data?.name) && data.name[0]) ||
        data?.detail ||
        "Failed to add allowance type";

      message.error(backendMsg);
    }
  };

  return (
    <Modal
      open={open}
      title="Add Allowance Type"
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={submit}
      okText="Save"
      destroyOnHidden   // ✅ Updated for AntD v5
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Name required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Code"
          name="code"
          rules={[{ required: true, message: "Code required" }]}
        >
          <Input />
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

export default AddAllowanceType;
