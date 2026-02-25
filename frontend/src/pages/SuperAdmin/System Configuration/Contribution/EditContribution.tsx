// src/pages/SuperAdmin/System Configuration/Contribution/EditContribution.tsx

type EditArgs = {
  record: any;
  setIsEditMode: (val: boolean) => void;
  setEditingId: (val: number | null) => void;
  setAmountType: (val: "manual" | "percent") => void;
  setIsModalOpen: (val: boolean) => void;
  form: any;
};

/* ================================
   🔒 Sanitizers
================================ */

// ✅ CODE → Letters only (no numbers, no special characters, no spaces)
const sanitizeCode = (value: any) => {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, ""); // remove numbers + symbols + spaces
};

// ✅ NAME → Letters + spaces only
const sanitizeName = (value: any) => {
  return String(value ?? "")
    .replace(/[^A-Za-z ]/g, "") // remove numbers + symbols
    .replace(/\s+/g, " ") // collapse multiple spaces
    .replace(/^\s+/g, ""); // remove leading space
};

/* ================================
   ✏️ Edit Contribution Handler
================================ */

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
    // ✅ Inject sanitized values
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