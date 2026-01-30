import React from "react";
import { Modal, Form, Input, Select, Button } from "antd";
import styles from "./Add_department.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddDepartment: React.FC<Props> = ({ open, onClose }) => {
  return (
    <Modal
      title="Add Department & Shift"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      className={styles.modal}
    >
      <Form layout="vertical" className={styles.form}>
        <Form.Item label="Name" name="name">
          <Input placeholder="Name" />
        </Form.Item>

        <Form.Item label="Manager" name="manager">
          <Select placeholder="Choose" />
        </Form.Item>

        <Form.Item label="Parent department" name="parent">
          <Select placeholder="Choose" />
        </Form.Item>

        <Form.Item label="Work Shift" name="shift">
          <Select placeholder="Choose" />
        </Form.Item>

        <Form.Item label="Description" name="desc">
          <Input.TextArea placeholder="Placeholder" />
        </Form.Item>

        <div className={styles.actions}>
          <Button type="primary" className={styles.saveBtn}>
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default AddDepartment;
