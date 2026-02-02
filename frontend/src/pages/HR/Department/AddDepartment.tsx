import React, { useEffect, useState } from "react";
import { Modal, Form, Input, Select, Button, message } from "antd";
import styles from "./Add_department.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddDepartment: React.FC<Props> = ({ open, onClose }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch shifts from backend
  useEffect(() => {
    if (!open) return;

    fetch("http://localhost:8000/api/employees/shifts/") // adjust API URL if needed
      .then((res) => res.json())
      .then((data) => setShifts(data))
      .catch((err) => console.error(err));
  }, [open]);

  // Handle form submit
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/employees/departments/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name,
          shift_id: values.shift, // <-- this is key
        }),
      });

      if (!res.ok) throw new Error("Failed to create department");

      message.success("Department created successfully");
      onClose();
    } catch (error) {
      console.error(error);
      message.error("Error creating department");
    } finally {
      setLoading(false);
    }
  };


  return (
    <Modal
      title="Add Department & Shift"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className={styles.modal}
    >
      <Form layout="vertical" className={styles.form} onFinish={onFinish}>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: "Please enter a department name" }]}
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

        <div className={styles.actions}>
          <Button
            type="primary"
            htmlType="submit"
            className={styles.saveBtn}
            loading={loading}
          >
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddDepartment;
