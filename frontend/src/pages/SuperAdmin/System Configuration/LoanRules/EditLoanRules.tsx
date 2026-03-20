//src/pages/SuperAdmin/System Configuration/LoanRules/EditLoanRules.tsx

import dayjs from "dayjs";

type Params = {
  rule: any;
  setEditMode: (value: boolean) => void;
  setEditingId: (value: number | null) => void;
  setLoanModalOpen: (value: boolean) => void;
  form: any;
};

export const editLoanRule = ({
  rule,
  setEditMode,
  setEditingId,
  setLoanModalOpen,
  form,
}: Params) => {
  setEditMode(true);
  setEditingId(rule.id);
  setLoanModalOpen(true);

  form.setFieldsValue({
    name: rule.name,
    department: rule.department || null,
    employee: rule.employee || null,
    deduction_mode: rule.deduction_mode,
    deduction_value:
    rule.deduction_mode === "PERCENT"
        ? Number(rule.deduction_value) * 100
        : Number(rule.deduction_value),
    apply_to_cutoff: rule.apply_to_cutoff,
    effective_from: rule.effective_from ? dayjs(rule.effective_from) : null,
    effective_to: rule.effective_to ? dayjs(rule.effective_to) : null,
    is_active: rule.is_active,
  });
};