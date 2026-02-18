"use client";

import React, { useEffect, useState } from "react";
import { Button, Form, Spin, message } from "antd";
import { EditOutlined } from "@ant-design/icons";
import API from "../../../../api/axios";
import "../SystemConfiguration.css";

import AddCommissionType from "./AddCommissionType";
import { editCommissionType } from "./EditCommissionType";

type Props = {
  active: boolean;
};

export default function CommissionTypeTab({ active }: Props) {
  const [loading, setLoading] = useState(false);
  const [commissionTypes, setCommissionTypes] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form] = Form.useForm();

  const fetchCommissionTypes = async () => {
    setLoading(true);
    try {
      const res = await API.get(
        "/approvals/superadmin/commission-types/"
      );
      setCommissionTypes([...res.data].reverse());
    } catch (err) {
      console.error(err);
      message.error("Failed to fetch commission types.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!active) return;
    fetchCommissionTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleEdit = (commission: any) => {
    editCommissionType({
      commission,
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
        name: values.name,
        code: values.code,
        is_taxable: values.is_taxable,
        is_active: values.is_active,
      };

      if (editMode && editingId) {
        await API.put(
          `/approvals/superadmin/commission-types/${editingId}/`,
          payload
        );
        message.success("Commission type updated.");
      } else {
        await API.post(
          "/approvals/superadmin/commission-types/create/",
          payload
        );
        message.success("Commission type added.");
      }

      closeModal();
      fetchCommissionTypes();
    } catch (err) {
      console.error(err);
      message.error("Failed to save commission type.");
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
          Add Commission Type
        </Button>
      </div>

      {loading ? (
        <Spin />
      ) : (
        <table className="config-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Taxable?</th>
              <th>Active</th>
              <th >Created</th>
              <th style={{ textAlign: "center" }}>Actions</th>
              {/* <th>Actions</th> */}
            </tr>
          </thead>
          <tbody>
            {commissionTypes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.code}</td>
                <td>{c.is_taxable ? "Yes" : "No"}</td>
                <td>{c.is_active ? "Yes" : "No"}</td>
                <td>{c.created_at}</td>
                <td className="actions">
                  <EditOutlined onClick={() => handleEdit(c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <AddCommissionType
        open={modalOpen}
        title={
          editMode ? "Edit Commission Type" : "Add Commission Type"
        }
        onCancel={closeModal}
        onOk={handleSave}
        form={form}
      />
    </div>
  );
}
