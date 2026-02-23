import React from "react";
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
import dayjs from "dayjs";

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

// ✅ Shift name: letters + spaces only (no numbers, no special chars)
const SHIFT_NAME_REGEX = /^[A-Za-z]+(?:\s[A-Za-z]+)*$/;

// ✅ Block letters/special chars for InputNumber (v6-safe)
const allowOnlyDigitsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  const navKeys = [
    "Backspace",
    "Delete",
    "Tab",
    "Enter",
    "Escape",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
  ];

  // allow ctrl/cmd shortcuts (copy/paste/select all)
  if (e.ctrlKey || e.metaKey) return;

  if (navKeys.includes(e.key)) return;

  // allow only 0-9
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
};

const allowOnlyDigitsPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  const text = e.clipboardData.getData("text");
  if (!/^\d+$/.test(text)) e.preventDefault();
};

const AddShift = ({ open, onClose, refresh }: any) => {
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    const selectedDays: number[] = values.workdays_selected || [];

    const payload: any = {
      ...values,
      // UI is 12h AM/PM, backend receives 24h HH:mm
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),
      // nested workdays
      workdays: DAYS.map((d) => ({
        day_of_week: d.value,
        is_workday: selectedDays.includes(d.value),
      })),
    };

    // remove helper field
    delete payload.workdays_selected;

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
          workdays_selected: [1, 2, 3, 4, 5],
          break_minutes: 0,
          grace_minutes: 0,
          is_overnight: false,
        }}
      >
        <Form.Item
          name="name"
          label="Shift Name"
          normalize={(val) =>
            typeof val === "string" ? val.replace(/\s+/g, " ").trimStart() : val
          }
          rules={[
            { required: true, message: "Shift name is required" },
            {
              validator: (_, value) => {
                const v = (value ?? "").trim();
                if (!v) return Promise.resolve(); // required handles empty
                if (!SHIFT_NAME_REGEX.test(v)) {
                  return Promise.reject(
                    new Error("Shift name must contain letters and spaces only.")
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input placeholder="e.g. Morning Shift" />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="start_time"
              label="Start Time"
              rules={[{ required: true, message: "Start time is required" }]}
            >
              {/* ✅ More user-friendly time picker */}
              <TimePicker
                style={{ width: "100%" }}
                use12Hours
                format="hh:mm A"
                minuteStep={5}
                inputReadOnly
                placeholder="Select start time"
                defaultOpenValue={dayjs("08:00", "HH:mm")}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="end_time"
              label="End Time"
              rules={[{ required: true, message: "End time is required" }]}
            >
              <TimePicker
                style={{ width: "100%" }}
                use12Hours
                format="hh:mm A"
                minuteStep={5}
                inputReadOnly
                placeholder="Select end time"
                defaultOpenValue={dayjs("17:00", "HH:mm")}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="break_minutes"
              label="Break Minutes"
              rules={[
                { type: "number", min: 0, message: "Break minutes must be 0 or higher." },
              ]}
            >
              {/* ✅ integers only, blocks alphabets + special chars */}
              <InputNumber
                min={0}
                precision={0}
                style={{ width: "100%" }}
                placeholder="e.g. 60"
                controls
                onKeyDown={allowOnlyDigitsKeyDown}
                onPaste={allowOnlyDigitsPaste}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="grace_minutes"
              label="Grace Minutes"
              rules={[
                { type: "number", min: 0, message: "Grace minutes must be 0 or higher." },
              ]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{ width: "100%" }}
                placeholder="e.g. 15"
                controls
                onKeyDown={allowOnlyDigitsKeyDown}
                onPaste={allowOnlyDigitsPaste}
              />
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
            {
              type: "array" as any,
              required: true,
              message: "Select at least 1 workday",
            },
          ]}
        >
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