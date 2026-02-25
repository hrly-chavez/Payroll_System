//src/pages/HR/Requests/AttendanceCorrectionRequest/CreateAttendance.tsx

import React, { useMemo, useState } from "react";
import { Button, Form, Input, Select, Space, TimePicker, InputNumber, Card } from "antd";
import dayjs, { Dayjs } from "dayjs";

export type EventRow = {
  type: string;
  minutes: number;
  start_time: Dayjs | null;
  end_time: Dayjs | null;
  approval_status: "Pending" | "Approved" | "Declined";
  event_remarks: string;
  holiday_id?: number | null;
};

const TYPE_OPTIONS = [
  "Night Differential",
  "Late",
  "Undertime",
  "Overtime",
  "Regular Holiday",
  "Special Holiday",
  "Special Non Working Holiday",
  "Company Holiday",
  "Absent",
].map((v) => ({ value: v, label: v }));

const APPROVAL_OPTIONS = ["Pending", "Approved", "Declined"].map((v) => ({
  value: v,
  label: v,
}));

interface Props {
  disabled?: boolean;
  onChange: (events: EventRow[]) => void;
}

const CreateAttendance: React.FC<Props> = ({ disabled, onChange }) => {
  const [events, setEvents] = useState<EventRow[]>([]);

  const pushChange = (next: EventRow[]) => {
    setEvents(next);
    onChange(next);
  };

  const addEvent = () => {
    const newRow: EventRow = {
        type: "Late",
        minutes: 0,
        start_time: null,
        end_time: null,
        approval_status: "Approved",
        event_remarks: "",
    };

    const next: EventRow[] = [...events, newRow];
    pushChange(next);
    };

  const removeEvent = (idx: number) => {
    const next = events.filter((_, i) => i !== idx);
    pushChange(next);
  };

  const updateEvent = (idx: number, patch: Partial<EventRow>) => {
    const next = events.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    pushChange(next);
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={addEvent} disabled={disabled}>
          Add Event
        </Button>
      </Space>

      {events.map((e, idx) => (
        <Card key={idx} size="small" style={{ marginBottom: 12 }}>
          <Form layout="vertical">
            <Form.Item label="Type" required>
              <Select
                options={TYPE_OPTIONS}
                value={e.type}
                onChange={(v) => updateEvent(idx, { type: v })}
                disabled={disabled}
              />
            </Form.Item>

            <Form.Item label="Minutes">
              <InputNumber
                min={0}
                value={e.minutes}
                onChange={(v) => updateEvent(idx, { minutes: Number(v || 0) })}
                style={{ width: "100%" }}
                disabled={disabled}
              />
            </Form.Item>

            <Form.Item label="Start Time">
              <TimePicker
                value={e.start_time}
                getPopupContainer={(trigger) => trigger.parentElement as HTMLElement}
                onChange={(v) => updateEvent(idx, { start_time: v })}
                style={{ width: "100%" }}
                disabled={disabled}
              />
            </Form.Item>

            <Form.Item label="End Time">
              <TimePicker
                value={e.end_time}
                getPopupContainer={(trigger) => trigger.parentElement as HTMLElement}
                onChange={(v) => updateEvent(idx, { end_time: v })}
                style={{ width: "100%" }}
                disabled={disabled}
              />
            </Form.Item>

            <Form.Item label="Approval Status">
              <Select
                options={APPROVAL_OPTIONS}
                value={e.approval_status}
                onChange={(v) => updateEvent(idx, { approval_status: v })}
                disabled={disabled}
              />
            </Form.Item>

            <Form.Item label="Remarks" required>
              <Input.TextArea
                rows={2}
                value={e.event_remarks}
                onChange={(ev) => updateEvent(idx, { event_remarks: ev.target.value })}
                placeholder="Required"
                disabled={disabled}
              />
            </Form.Item>

            <Space>
              <Button danger onClick={() => removeEvent(idx)} disabled={disabled}>
                Remove
              </Button>
            </Space>
          </Form>
        </Card>
      ))}
    </div>
  );
};

export default CreateAttendance;