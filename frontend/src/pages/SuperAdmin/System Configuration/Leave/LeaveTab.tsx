// src/pages/SuperAdmin/System Configuration/Leave/LeaveTab.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddLeaveType from "./AddLeaveType";
import { editLeaveType } from "./EditLeaveType";

type Props = {
  active: boolean;
};

export default function LeaveTab({ active }: Props) {
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);

  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveEditMode, setLeaveEditMode] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<number | null>(null);

  const [leaveForm] = Form.useForm();

  const getApiErrorMessage = (err: any, fallback: string) => {
    const data = err?.response?.data;

    if (!data) return fallback;

    // DRF common styles
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;

    // Field errors: { field: ["msg"] }
    if (typeof data === "object") {
      const firstKey = Object.keys(data)[0];
      const val = (data as any)[firstKey];
      if (Array.isArray(val) && val.length) return `${firstKey}: ${val[0]}`;
      if (typeof val === "string") return `${firstKey}: ${val}`;
    }

    return fallback;
  };


  const fetchLeaveTypes = async () => {
    setLoading(true);
    try {
      const res = await API.get("/approvals/superadmin/leave-types/");
      setLeaveTypes([...res.data].reverse());
    } catch (error) {
      console.error(error);
      message.error("Failed to fetch leave types.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchLeaveTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const openLeaveModal = () => {
    leaveForm.resetFields();
    setLeaveEditMode(false);
    setEditingLeaveId(null);
    setLeaveModalOpen(true);
  };

  const closeLeaveModal = () => {
    leaveForm.resetFields();
    setLeaveEditMode(false);
    setEditingLeaveId(null);
    setLeaveModalOpen(false);
  };

  const handleEditLeave = (leave: any) => {
    editLeaveType({
      leave,
      setLeaveEditMode,
      setEditingLeaveId,
      setLeaveModalOpen,
      leaveForm,
    });
  };

  const handleSaveLeave = async () => {
    try {
      const values = await leaveForm.validateFields();

      const payload = {
        name: values.name,
        is_paid: values.is_paid ?? false,
        requires_approval: values.requires_approval ?? true,
        is_active: values.is_active ?? true,
      };

      if (leaveEditMode && editingLeaveId) {
        await API.put(`/approvals/superadmin/leave-types/${editingLeaveId}/`, payload);
        message.success("Leave type updated successfully");
      } else {
        await API.post("/approvals/superadmin/leave-types/create/", payload);
        message.success("Leave type added successfully");
      }

      closeLeaveModal();
      fetchLeaveTypes();
    } catch (error: any) {
      console.error(error);
      message.error(getApiErrorMessage(error, "Failed to save leave type."));
    }
  };

  return (
    <div className="table-wrapper">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button type="primary" onClick={openLeaveModal}>
          Add New Leave Type
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Paid?</th>
              
              <th>Requires Approval</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.map((leave) => (
              <tr key={leave.id}>
                <td>{leave.name}</td>
                <td>{leave.is_paid ? "Yes" : "No"}</td>
                
                <td>{leave.requires_approval ? "Yes" : "No"}</td>
                <td>{leave.is_active ? "Yes" : "No"}</td>
                <td className="actions">
                  <EditOutlined onClick={() => handleEditLeave(leave)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddLeaveType
        open={leaveModalOpen}
        title={leaveEditMode ? "Edit Leave Type" : "Add Leave Type"}
        onCancel={closeLeaveModal}
        onOk={handleSaveLeave}
        form={leaveForm}
      />
    </div>
  );
}
