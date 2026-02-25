// src/pages/SuperAdmin/System Configuration/Contribution/EditContribution.tsx

type EditArgs = {
  record: any;
  setIsEditMode: (val: boolean) => void;
  setEditingId: (val: number | null) => void;
  setAmountType: (val: "manual" | "percent") => void;
  setIsModalOpen: (val: boolean) => void;
  form: any;
};

const sanitizeCode = (value: any) => {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
};

const sanitizeName = (value: any) => {
  return String(value ?? "")
    .replace(/[^A-Za-z ]/g, "")
    .replace(/\s+/g, " ") 
    .replace(/^\s+/g, ""); 
};



export function editContribution({
  record,
  setIsEditMode,
  setEditingId,
  setAmountType,
  setIsModalOpen,
  form,
}: EditArgs) {
  const type =
    record?.calculation_type === "Percent" ? "percent" : "manual";

  setIsEditMode(true);
  setEditingId(record?.id ?? null);
  setAmountType(type);

  form.setFieldsValue({
    code: sanitizeCode(record?.code),
    name: sanitizeName(record?.name),

    category: record?.category || "OTHER",
    salaryFrom: record?.salary_range_from,
    salaryTo: record?.salary_range_to,
    amountType: type,
    amount: record?.amount,
  });

  setIsModalOpen(true);
}