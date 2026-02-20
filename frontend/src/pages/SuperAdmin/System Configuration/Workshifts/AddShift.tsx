import {
  Modal,
  Form,
  Input,
  TimePicker,
  InputNumber,
  Switch,
  message,
  Row,
  Col,
  Divider,
  Tag,
} from "antd";
import api from "../../../../api/axios";

const { CheckableTag } = Tag;

const DAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

const AddShift = ({ open, onClose, refresh }: any) => {
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    const selectedDays: number[] = values.workdays_selected || [];

    const payload = {
      ...values,
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),
      // create nested workdays
      workdays: DAYS.map((d) => ({
        day_of_week: d.value,
        is_workday: selectedDays.includes(d.value),
      })),
    };

    // remove helper field (not needed by backend)
    delete (payload as any).workdays_selected;

    await api.post("attendance/shifts/", payload);

    message.success("Shift created");
    form.resetFields();
    onClose();
    refresh();
  };

  return (
    <Modal
      width={650}
      title="Add Shift"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{
          // default: Mon–Fri selected (change if you want all 7 default)
          workdays_selected: [1, 2, 3, 4, 5],
          break_minutes: 0,
          grace_minutes: 0,
          is_overnight: false,
        }}
      >
        <Form.Item
          name="name"
          label="Shift Name"
          rules={[{ required: true, message: "Shift name is required" }]}
        >
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="start_time"
              label="Start Time"
              rules={[{ required: true, message: "Start time is required" }]}
            >
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="end_time"
              label="End Time"
              rules={[{ required: true, message: "End time is required" }]}
            >
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="break_minutes" label="Break Minutes">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="grace_minutes" label="Grace Minutes">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="is_overnight" label="Overnight" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Divider style={{ margin: "12px 0" }} />

        {/* ✅ Workdays selector */}
        <Form.Item
          name="workdays_selected"
          label="Workdays (click to toggle)"
          rules={[
            { type: "array" as any, required: true, message: "Select at least 1 workday" },
          ]}
        >
          {/* We manually render tags and update the array value */}
          <WorkdayTags form={form} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const WorkdayTags = ({ form }: { form: any }) => {
  const selected: number[] = Form.useWatch("workdays_selected", form) || [];

  const toggle = (day: number, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selected, day]))
      : selected.filter((d) => d !== day);

    form.setFieldsValue({ workdays_selected: next });
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {DAYS.map((d) => (
        <CheckableTag
          key={d.value}
          checked={selected.includes(d.value)}
          onChange={(checked) => toggle(d.value, checked)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #d9d9d9",
            userSelect: "none",
          }}
        >
          {d.label}
        </CheckableTag>
      ))}
    </div>
  );
};

export default AddShift;