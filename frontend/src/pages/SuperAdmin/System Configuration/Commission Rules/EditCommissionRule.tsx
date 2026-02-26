// src/pages/SuperAdmin/System Configuration/Commission Rules/EditCommissionRule.ts
"use client";

import dayjs from "dayjs";

type Args = {
  rule: any;
  setEditMode: (v: boolean) => void;
  setEditingId: (id: number | null) => void;
  setModalOpen: (v: boolean) => void;
  form: any;
};

export const editCommissionRule = ({
  rule,
  setEditMode,
  setEditingId,
  setModalOpen,
  form,
}: Args) => {
  setEditMode(true);
  setEditingId(rule.id);
  setModalOpen(true);

  form.resetFields();

  form.setFieldsValue({
    name: rule.name,
    commission_type: rule.commission_type,

    min_amount: rule.min_amount,
    max_amount: rule.max_amount,

    rate_type: rule.rate_type,
    rate_value: rule.rate_value,

    applies_to: rule.applies_to || null,
    employee: rule.employee || null,

    effective_from: rule.effective_from ? dayjs(rule.effective_from) : null,
    effective_to: rule.effective_to ? dayjs(rule.effective_to) : null,
  });
};