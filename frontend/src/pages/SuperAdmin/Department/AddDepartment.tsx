import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Button, message } from "antd";
import styles from "./Add_department.module.css";
import api from "../../../api/axios";

// ---------------- Interfaces ----------------
export interface DepartmentType {
  id?: number;
  name: string;
  shift?: number;
  holiday_base: string[];
  is_active?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues?: DepartmentType; // optional for editing
}
// --------------------------------------------

const AddDepartment: React.FC<Props> = ({ open, onClose, initialValues }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [holidayOptions, setHolidayOptions] = useState<
    { label: string; value: string }[]
  >([]);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch shifts
  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      try {
        // Fetch shifts
        const shiftRes = await api.get("/employees/shifts/");
        setShifts(shiftRes.data);

        // Fetch holiday options
        const holidayRes = await api.get(
          "/employees/departments/holiday_base_choices/"
        );
        setHolidayOptions(holidayRes.data);

      } catch (err) {
        console.error(err);
        message.error("Failed to load data");
      }
    };

    fetchData();
  }, [open]);

  const handleHolidayChange = (values: string[]) => {
    // If all selected → close dropdown
    if (values.length === holidayOptions.length) {
      setTimeout(() => setDropdownOpen(false), 150);
    }
  };

  // Handle submit: create or update
  const onFinish = async (values: any) => {
    setLoading(true);
    const sanitizedName = values.name.trim();

    try {
      if (initialValues?.id) {
        // Update existing
        await api.patch(`/employees/departments/${initialValues.id}/`, {
          name: sanitizedName,
          shift_id: values.shift,
          holiday_base: values.holiday_base,
        });
        message.success("Department updated successfully");
      } else {
        // Create new
        await api.post("/employees/departments/", {
          name: sanitizedName,
          shift_id: values.shift,
          holiday_base: values.holiday_base,
        });
        message.success("Department created successfully");
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      message.error(error.response?.data?.message || "Error saving department");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={initialValues?.id ? "Edit Department" : "Add Department & Shift"}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className={styles.modal}
    >
      <Form
        layout="vertical"
        className={styles.form}
        onFinish={onFinish}
        initialValues={{
          name: initialValues?.name,
          shift: initialValues?.shift,
          holiday_base: initialValues?.holiday_base,
        }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, message: "Please enter a department name" },
            { max: 50, message: "Department name cannot exceed 50 characters" },
            {
              pattern: /^[A-Za-z0-9\s]+$/,
              message: "Name can only contain letters, numbers, and spaces",
            },
          ]}
        >
          <Input placeholder="Name" />
        </Form.Item>

        <Form.Item
          label="Work Shift"
          name="shift"
          rules={[{ required: true, message: "Please select a shift" }]}
        >
          <Select placeholder="Choose" loading={shifts.length === 0}>
            {shifts.map((shift) => (
              <Select.Option key={shift.id} value={shift.id}>
                {shift.start_time} - {shift.end_time}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Holiday Base"
          name="holiday_base"
          rules={[{ required: true, message: "Please select a holiday base" }]}
        >
          <Select
            mode="multiple"
            maxTagCount="responsive"
            placeholder="Choose"
            options={holidayOptions}
            open={dropdownOpen}
            onDropdownVisibleChange={(open) => setDropdownOpen(open)}
            onChange={handleHolidayChange}
          />
        </Form.Item>

        <div className={styles.actions}>
          <Button type="primary" htmlType="submit" className={styles.saveBtn} loading={loading}>
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddDepartment;