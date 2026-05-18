"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddLeaveCreditMax from "./AddLeaveCreditMax";
import { editLeaveCreditMax } from "./EditLeaveCreditMax";

type Props = {
  active: boolean;
};

export default function LeaveCreditMaxTab({ active }: Props) {
  const [loading, setLoading] = useState(false);
  const [leaveCreditMaxList, setLeaveCreditMaxList] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form] = Form.useForm();

  const getApiErrorMessage = (err: any, fallback: string) => {
    const data = err?.response?.data;

    if (!data) return fallback;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;

    if (typeof data === "object") {
      const firstKey = Object.keys(data)[0];
      const val = data[firstKey];

      if (Array.isArray(val) && val.length) {
        return `${firstKey}: ${val[0]}`;
      }

      if (typeof val === "string") {
        return `${firstKey}: ${val}`;
      }
    }

    return fallback;
  };

  const fetchLeaveCreditMax = async () => {
    setLoading(true);

    try {
      const res = await API.get("/approvals/superadmin/leave-credit-max/");
      setLeaveCreditMaxList([...res.data].reverse());
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch leave credit max.");
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchLeaveCreditMax();
  }, [active]);

  const openModal = () => {
    form.resetFields();
    setEditMode(false);
    setEditingId(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    form.resetFields();
    setEditMode(false);
    setEditingId(null);
    setModalOpen(false);
  };

  const handleEdit = (leaveCreditMax: any) => {
    editLeaveCreditMax({
      leaveCreditMax,
      setEditMode,
      setEditingId,
      setModalOpen,
      form,
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        leave_type: values.leave_type,
        max_credit: Number(values.max_credit),
        is_active: values.is_active ?? true,
      };

      if (editMode && editingId) {
        await API.put(
          `/approvals/superadmin/leave-credit-max/${editingId}/`,
          payload
        );

        message.success("Leave credit max updated successfully");
      } else {
        await API.post(
          "/approvals/superadmin/leave-credit-max/create/",
          payload
        );

        message.success("Leave credit max added successfully");
      }

      closeModal();
      fetchLeaveCreditMax();
    } catch (error: any) {
      console.error(error);
      message.error(
        getApiErrorMessage(error, "Failed to save leave credit max.")
      );
    }
  };

  return (
    <div className="table-wrapper">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: 12,
        }}
      >
        <Button type="primary" onClick={openModal}>
          Add Leave Credit Max
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Max Credit</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {leaveCreditMaxList.map((item) => (
              <tr key={item.id}>
                <td>{item.leave_type_name || item.leave_type}</td>
                <td>{item.max_credit}</td>
                <td>{item.is_active ? "Yes" : "No"}</td>
                <td className="actions">
                  <EditOutlined onClick={() => handleEdit(item)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddLeaveCreditMax
        open={modalOpen}
        title={editMode ? "Edit Leave Credit Max" : "Add Leave Credit Max"}
        onCancel={closeModal}
        onOk={handleSave}
        form={form}
      />
    </div>
  );
}