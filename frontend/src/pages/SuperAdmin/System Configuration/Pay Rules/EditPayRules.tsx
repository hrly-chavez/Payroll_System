// src/pages/SuperAdmin/System Configuration/Pay Rules/EditPayRules.tsx
import dayjs from "dayjs";

type EditArgs = {
  rule: any;
  setPayRuleEditMode: (val: boolean) => void;
  setEditingPayRuleId: (val: number | null) => void;
  setPayrollModalOpen: (val: boolean) => void;
  payrollForm: any;
};

export function editPayRule({
  rule,
  setPayRuleEditMode,
  setEditingPayRuleId,
  setPayrollModalOpen,
  payrollForm,
}: EditArgs) {
  setPayRuleEditMode(true);
  setEditingPayRuleId(rule.id); 

 let scope = "ALL";

if (rule.employee) {
  scope = "EMPLOYEE";
} else if (rule.applies_to) {
  scope = "DEPARTMENT";
}

payrollForm.setFieldsValue({
  name: rule.name,
  event_type: rule.event_type,
  category: rule.category,
  rate_type: rule.rate_type,
  rate_value: rule.rate_value,
  applies_to: rule.applies_to || null,
  employee: rule.employee || null,
  scope, 
  effective_from: rule.effective_from ? dayjs(rule.effective_from) : null,
  effective_to: rule.effective_to ? dayjs(rule.effective_to) : null,
  is_active: rule.is_active,
});

  setPayrollModalOpen(true);
}
