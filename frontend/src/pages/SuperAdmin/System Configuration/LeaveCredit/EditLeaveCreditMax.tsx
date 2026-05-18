type EditLeaveCreditMaxProps = {
  leaveCreditMax: any;
  setEditMode: (value: boolean) => void;
  setEditingId: (id: number | null) => void;
  setModalOpen: (value: boolean) => void;
  form: any;
};

export const editLeaveCreditMax = ({
  leaveCreditMax,
  setEditMode,
  setEditingId,
  setModalOpen,
  form,
}: EditLeaveCreditMaxProps) => {
  setEditMode(true);
  setEditingId(leaveCreditMax.id);

  form.setFieldsValue({
    leave_type: leaveCreditMax.leave_type,
    max_credit: leaveCreditMax.max_credit,
    is_active: leaveCreditMax.is_active,
  });

  setModalOpen(true);
};