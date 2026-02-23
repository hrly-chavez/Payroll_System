type EditCommissionArgs = {
  commission: any;
  setEditMode: (val: boolean) => void;
  setEditingId: (id: number) => void;
  setModalOpen: (val: boolean) => void;
  form: any;
};

export const editCommissionType = ({
  commission,
  setEditMode,
  setEditingId,
  setModalOpen,
  form,
}: EditCommissionArgs) => {
  setEditMode(true);
  setEditingId(commission.id);

  form.setFieldsValue({
    name: commission.name,
    code: commission.code,
    is_taxable: commission.is_taxable,
    is_active: commission.is_active,
  });
 
  setModalOpen(true);
};
