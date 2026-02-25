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
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Name required" },
            {
              pattern: /^[A-Za-z ]+$/,
              message: "Only letters and spaces are allowed",
            },
          ]}
        >
          <Input
            placeholder="Enter allowance type name"
            maxLength={50}
            onChange={(e) => {
              // remove numbers and special characters instantly
              const cleaned = e.target.value.replace(/[^A-Za-z ]/g, "");
              form.setFieldsValue({ name: cleaned });
            }}
          />
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