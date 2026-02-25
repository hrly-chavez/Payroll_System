import {Modal,Form,Input,TimePicker,Switch,message,Row,Col,Tooltip,Divider,Tag,
} from "antd";
import api from "../../../../api/axios";
import { useEffect } from "react";
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

const digitsOnly = (v: string) => (v ?? "").replace(/[^\d]/g, "");
const clamp999 = (v: string) => {
  const n = Number(v || 0);
  if (Number.isNaN(n)) return "";
  return String(Math.min(Math.max(n, 0), 999));
};

const EditShift = ({ open, onClose, shift, refresh }: any) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (shift) {
      const selectedDays =
        Array.isArray(shift.workdays) && shift.workdays.length
          ? shift.workdays
              .filter((w: any) => w?.is_workday)
              .map((w: any) => Number(w.day_of_week))
          : [1, 2, 3, 4, 5];

      form.setFieldsValue({
        ...shift,
        start_time: dayjs(shift.start_time, "HH:mm"),
        end_time: dayjs(shift.end_time, "HH:mm"),

        break_mins: String(shift.break_minutes ?? 0),
        grace_minutes: String(shift.grace_minutes ?? 0),

        is_overnight: !!shift.is_overnight,
        is_active: shift.is_active ?? true,

        workdays_selected: selectedDays,
      });
    }
  }, [shift, form]);

  const confirmToggle = (fieldName: "is_overnight" | "is_active") => {
    const currentValue = !!form.getFieldValue(fieldName);
    const nextValue = !currentValue;

    const messageText =
      fieldName === "is_active"
        ? currentValue
          ? "Are you sure you want to deactivate this shift?"
          : "Are you sure you want to activate this shift?"
        : currentValue
        ? "Are you sure you want to remove overnight from this shift?"
        : "Are you sure you want to mark this shift as overnight?";

    Modal.confirm({
      title: "Confirm Change",
      content: messageText,
      okText: "Yes",
      cancelText: "No",
      centered: true,
      onOk() {
        form.setFieldsValue({ [fieldName]: nextValue });
      },
    });
  };

  const onFinish = async (values: any) => {
    const selectedDays: number[] = values.workdays_selected || [];

    const payload: any = {
      ...values,
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),

      break_minutes: Number(values.break_mins || 0),
      grace_minutes: Number(values.grace_minutes || 0),

      workdays: DAYS.map((d) => ({
        day_of_week: d.value,
        is_workday: selectedDays.includes(d.value),
      })),
    };

    delete payload.workdays_selected;
    delete payload.break_mins;

    await api.put(`attendance/shifts/${shift.id}/`, payload);

    message.success("Shift updated");
    onClose();
    refresh();
  };

  return (
    <Modal
      width={650}
      title="Edit Shift"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
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
              label="Start Time"
              name="start_time"
              rules={[{ required: true, message: "Start time is required" }]}
            >
              <TimePicker use12Hours format="hh:mm A" inputReadOnly />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="End Time"
              name="end_time"
              rules={[{ required: true, message: "End time is required" }]}
            >
              <TimePicker use12Hours format="hh:mm A" inputReadOnly />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Break (mins)"
              name="break_mins"
              rules={[
                { required: true, message: "Break minutes is required" },
                { pattern: /^\d+$/, message: "Digits only" },
                {
                  validator: async (_: any, value: string) => {
                    const n = Number(value);
                    if (Number.isNaN(n))
                      throw new Error("Digits only");
                    if (n < 0 || n > 999)
                      throw new Error("Must be between 0 and 999");
                  },
                },
              ]}
            >
              <Input
                inputMode="numeric"
                placeholder="0"
                maxLength={3}
                onChange={(e) => {
                  const cleaned = clamp999(digitsOnly(e.target.value));
                  form.setFieldsValue({ break_mins: cleaned });
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const current = String(form.getFieldValue("break_mins") || "");
                  const cleaned = clamp999(digitsOnly(current + pasted));
                  form.setFieldsValue({ break_mins: cleaned });
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              name="grace_minutes"
              label="Grace Minutes"
              rules={[
                { required: true, message: "Grace minutes is required" },
                { pattern: /^\d+$/, message: "Digits only" },
                {
                  validator: async (_: any, value: string) => {
                    const n = Number(value);
                    if (Number.isNaN(n))
                      throw new Error("Digits only");
                    if (n < 0 || n > 999)
                      throw new Error("Must be between 0 and 999");
                  },
                },
              ]}
            >
              <Input
                inputMode="numeric"
                placeholder="0"
                maxLength={3}
                onChange={(e) => {
                  const cleaned = clamp999(digitsOnly(e.target.value));
                  form.setFieldsValue({ grace_minutes: cleaned });
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text");
                  const current = String(
                    form.getFieldValue("grace_minutes") || ""
                  );
                  const cleaned = clamp999(digitsOnly(current + pasted));
                  form.setFieldsValue({ grace_minutes: cleaned });
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        <Form.Item
          name="workdays_selected"
          label="Workdays (click to toggle)"
          rules={[
            {
              validator: async (_: any, value: number[]) => {
                if (!value || value.length === 0) {
                  throw new Error("Select at least 1 workday");
                }
              },
            },
          ]}
        >
          <WorkdayTags form={form} />
        </Form.Item>

        <Form.Item name="is_overnight" hidden>
          <Input />
        </Form.Item>

        <Form.Item name="is_active" hidden>
          <Input />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Overnight">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_overnight");
                  return (
                    <Tooltip title={value ? "Remove Overnight" : "Mark as Overnight"}>
                      <Switch
                        checked={value}
                        onClick={() => confirmToggle("is_overnight")}
                      />
                    </Tooltip>
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item label="Active">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_active");
                  return (
                    <Tooltip title={value ? "Deactivate" : "Activate"}>
                      <Switch
                        checked={value}
                        onClick={() => confirmToggle("is_active")}
                      />
                    </Tooltip>
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Col>
        </Row>
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

export default EditShift;