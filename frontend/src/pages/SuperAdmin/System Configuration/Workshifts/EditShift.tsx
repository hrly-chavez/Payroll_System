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
  Tooltip,
  Divider,
  Tag,
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

const EditShift = ({ open, onClose, shift, refresh }: any) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (shift) {
      // ✅ convert existing workdays -> selected day numbers
      const selectedDays =
        Array.isArray(shift.workdays) && shift.workdays.length
          ? shift.workdays
              .filter((w: any) => w?.is_workday)
              .map((w: any) => Number(w.day_of_week))
          : [1, 2, 3, 4, 5]; // fallback default if none returned

      form.setFieldsValue({
        ...shift,
        start_time: dayjs(shift.start_time, "HH:mm"),
        end_time: dayjs(shift.end_time, "HH:mm"),

        break_minutes: shift.break_minutes ?? 0,
        grace_minutes: shift.grace_minutes ?? 0,

        // ensure booleans exist (avoid undefined issues)
        is_overnight: !!shift.is_overnight,
        is_active: shift.is_active ?? true,

        // ✅ helper field for UI
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

    const payload = {
      ...values,
      start_time: values.start_time.format("HH:mm"),
      end_time: values.end_time.format("HH:mm"),
      // ✅ nested data for backend
      workdays: DAYS.map((d) => ({
        day_of_week: d.value,
        is_workday: selectedDays.includes(d.value),
      })),
    };

    // remove helper field
    delete (payload as any).workdays_selected;

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
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          name="name"
          label="Shift Name"
          rules={[{ required: true, message: "Shift name is required" }]}
        >
          <Input />
        </Form.Item>

        {/* Start + End time side-by-side */}
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

        {/* Break + Grace minutes side-by-side */}
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

        <Divider style={{ margin: "12px 0" }} />

        {/* ✅ Workdays selector */}
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

        {/* ✅ Keep values in form, but NOT bind switches directly (prevents toggle lock) */}
        <Form.Item name="is_overnight" hidden>
          <Input />
        </Form.Item>

        <Form.Item name="is_active" hidden>
          <Input />
        </Form.Item>

        {/* ✅ Overnight + Active side by side with hover + confirm */}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item label="Overnight">
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const value = !!getFieldValue("is_overnight");
                  return (
                    <Tooltip
                      title={value ? "Remove Overnight" : "Mark as Overnight"}
                    >
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