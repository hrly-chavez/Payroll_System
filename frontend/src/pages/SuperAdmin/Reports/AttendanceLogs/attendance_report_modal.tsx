import React, { useMemo, useState } from "react";
import { Modal, Form, Radio, DatePicker, Select, message } from "antd";
import dayjs, { Dayjs } from "dayjs";

type Mode = "all" | "user";
type FilterType = "date" | "month" | "year";

type Props = {
  open: boolean;
  onClose: () => void;
  onGenerate: (payload: {
    scope: Mode;
    employeeId?: number;
    filterType: FilterType;
    date?: string;  // YYYY-MM-DD
    month?: string; // YYYY-MM
    year?: string;  // YYYY
  }) => void;

  // optional: supply employee options
  employeeOptions?: { value: number; label: string }[];
};

const AttendanceReportModal: React.FC<Props> = ({
  open,
  onClose,
  onGenerate,
  employeeOptions = [],
}) => {
  const [form] = Form.useForm();

  const [mode, setMode] = useState<Mode>("all");
  const [filterType, setFilterType] = useState<FilterType>("month");

  const datePicker = useMemo(() => {
    if (filterType === "date") return <DatePicker style={{ width: "100%" }} />;
    if (filterType === "month") return <DatePicker picker="month" style={{ width: "100%" }} />;
    return <DatePicker picker="year" style={{ width: "100%" }} />;
  }, [filterType]);

  const handleOk = async () => {
    try {
      const v = await form.validateFields();

      const picked: Dayjs = v.picked;
      if (!picked) {
        message.warning("Please select a date/month/year.");
        return;
      }

      let payload: any = {
        scope: mode,
        filterType,
      };

      if (mode === "user") {
        payload.employeeId = v.employee_id;
      }

      if (filterType === "date") payload.date = picked.format("YYYY-MM-DD");
      if (filterType === "month") payload.month = picked.format("YYYY-MM");
      if (filterType === "year") payload.year = picked.format("YYYY");

      onGenerate(payload);
      onClose();
      form.resetFields();
      setMode("all");
      setFilterType("month");
    } catch {
      // validation errors already shown by AntD
    }
  };

  return (
    <Modal
      open={open}
      title="Generate Attendance Correction Report"
      okText="Generate PDF"
      onCancel={onClose}
      onOk={handleOk}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          picked: dayjs(),
        }}
      >
        <Form.Item label="Scope">
          <Radio.Group
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              if (e.target.value === "all") {
                form.setFieldsValue({ employee_id: undefined });
              }
            }}
          >
            <Radio value="all">All users</Radio>
            <Radio value="user">Specific user</Radio>
          </Radio.Group>
        </Form.Item>

        {mode === "user" && (
          <Form.Item
            name="employee_id"
            label="Employee"
            rules={[{ required: true, message: "Please select an employee." }]}
          >
            <Select
              showSearch
              placeholder="Select employee"
              options={employeeOptions}
              optionFilterProp="label"
              filterOption={(input, opt) =>
                (opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        )}

        <Form.Item label="Filter Type">
          <Radio.Group
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <Radio value="date">By date</Radio>
            <Radio value="month">By month</Radio>
            <Radio value="year">By year</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="picked"
          label={filterType === "date" ? "Select date" : filterType === "month" ? "Select month" : "Select year"}
          rules={[{ required: true, message: "This field is required." }]}
        >
          {datePicker}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AttendanceReportModal;