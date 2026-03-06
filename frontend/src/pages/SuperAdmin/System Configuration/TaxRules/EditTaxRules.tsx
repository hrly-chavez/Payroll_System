// src/pages/SuperAdmin/System Configuration/TaxRules/EditTaxRules.tsx
import dayjs from "dayjs";

type EditTaxRuleArgs = {
  rule: any;
  setEditMode: (v: boolean) => void;
  setEditingId: (id: number | null) => void;
  setTaxModalOpen: (v: boolean) => void;
  form: any; // AntD FormInstance
};

/**
 * Backend stores PERCENT rate_value as fraction (0.15 for 15%).
 * UI should show 15 (not 0.15).
 */
export const editTaxRule = ({
  rule,
  setEditMode,
  setEditingId,
  setTaxModalOpen,
  form,
}: EditTaxRuleArgs) => {
  setEditMode(true);
  setEditingId(rule.id);
  setTaxModalOpen(true);

  const rateType = rule.rate_type;
  const rawRate = rule.rate_value != null ? Number(rule.rate_value) : 0;

  const uiRateValue = rateType === "PERCENT" ? rawRate * 100 : rawRate;

  form.setFieldsValue({
    name: rule.name,

    min_amount: rule.min_amount != null ? Number(rule.min_amount) : 0,
    max_amount:
      rule.max_amount === null || rule.max_amount === undefined || rule.max_amount === ""
        ? null
        : Number(rule.max_amount),

    rate_type: rateType,
    rate_value: uiRateValue,

    apply_mode: rule.apply_mode,

    applies_to: rule.applies_to || null,
    employee: rule.employee || null,

    effective_from: rule.effective_from ? dayjs(rule.effective_from) : null,
    effective_to: rule.effective_to ? dayjs(rule.effective_to) : null,

    // remove "Active" checkbox in edit modal (status via toggle only)
    is_active: undefined,
  });
};