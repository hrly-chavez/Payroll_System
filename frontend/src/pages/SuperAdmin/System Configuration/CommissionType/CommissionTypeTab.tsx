"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Form, Spin, message, Input } from "antd";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";
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

  // ✅ Search
  const [search, setSearch] = useState("");

  const [form] = Form.useForm();

  // ✅ newest first (latest added on top)
  const fetchCommissionTypes = async () => {
    setLoading(true);
    try {
      const res = await API.get("/approvals/superadmin/commission-types/");

      const sorted = [...(res.data || [])].sort(
        (a: any, b: any) => (b.id ?? 0) - (a.id ?? 0)
      );

      setCommissionTypes(sorted);
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

  // ✅ filter while preserving newest-first
  const filteredCommissionTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commissionTypes;

    return commissionTypes
      .filter((c) => {
        const haystack = [
          c.name,
          c.code,
          c.is_taxable ? "yes" : "no",
          c.is_active ? "yes" : "no",
          c.created_at,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0));
  }, [commissionTypes, search]);

  return (
    <div className="table-wrapper">
      {/* ✅ Search (left) + Add button (right) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search commission types..."
          allowClear
          prefix={<SearchOutlined />}
          style={{ width: 320, maxWidth: "100%" }}
        />

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
              <th>Created</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCommissionTypes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.code}</td>
                <td>{c.is_taxable ? "Yes" : "No"}</td>
                <td>{c.is_active ? "Yes" : "No"}</td>
                <td>{c.created_at}</td>
                <td className="actions" style={{ textAlign: "center" }}>
                  <EditOutlined
                    style={{ cursor: "pointer" }}
                    onClick={() => handleEdit(c)}
                  />
                </td>
              </tr>
            ))}

            {filteredCommissionTypes.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: 16 }}>
                  No commission types found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <AddCommissionType
        open={modalOpen}
        title={editMode ? "Edit Commission Type" : "Add Commission Type"}
        onCancel={closeModal}
        onOk={handleSave}
        form={form}
      />
    </div>
  );
}
