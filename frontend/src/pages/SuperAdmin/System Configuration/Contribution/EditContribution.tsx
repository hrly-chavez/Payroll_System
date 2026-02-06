// src/pages/SuperAdmin/System Configuration/Contribution/EditContribution.tsx
type EditArgs = {
  record: any;
  setIsEditMode: (val: boolean) => void;
  setEditingId: (val: number | null) => void;
  setAmountType: (val: "manual" | "percent") => void;
  setIsModalOpen: (val: boolean) => void;
  form: any;
};

export function editContribution({
  record,
  setIsEditMode,
  setEditingId,
  setAmountType,
  setIsModalOpen,
  form,
}: EditArgs) {
  const type = record.calculation_type === "Percent" ? "percent" : "manual";

  setIsEditMode(true);
  setEditingId(record.id);
  setAmountType(type);

  form.setFieldsValue({
    name: record.code,
    salaryFrom: record.salary_range_from,
    salaryTo: record.salary_range_to,
    amountType: type,
    amount: record.amount,
  });

  setIsModalOpen(true);
}
