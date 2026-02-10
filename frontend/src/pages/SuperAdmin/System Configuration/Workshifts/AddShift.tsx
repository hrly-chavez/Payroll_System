import { Modal, Form, Input, TimePicker, InputNumber, Switch, message } from "antd";
import api from "../../../../api/axios";
import dayjs from "dayjs";

const AddShift = ({ open, onClose, refresh }: any) => {
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    await api.post("attendance/shifts/", {
      ...values,
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),
    });

    message.success("Shift created");
    form.resetFields();
    onClose();
    refresh();
  };

  return (
    <Modal
      title="Add Shift"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item name="name" label="Shift Name" required>
          <Input />
        </Form.Item>

        <Form.Item name="start_time" label="Start Time" required>
          <TimePicker format="HH:mm" />
        </Form.Item>

        <Form.Item name="end_time" label="End Time" required>
          <TimePicker format="HH:mm" />
        </Form.Item>

        <Form.Item name="break_minutes" label="Break Minutes">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="grace_minutes" label="Grace Minutes">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item name="is_overnight" label="Overnight" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddShift;
