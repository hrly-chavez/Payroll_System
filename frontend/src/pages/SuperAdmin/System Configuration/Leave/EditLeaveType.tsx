// src/pages/SuperAdmin/System Configuration/Leave/EditLeaveType.tsx
type EditArgs = {
  leave: any;
  setLeaveEditMode: (val: boolean) => void;
  setEditingLeaveId: (val: number | null) => void;
  setLeaveModalOpen: (val: boolean) => void;
  leaveForm: any;
};

export function editLeaveType({
  leave,
  setLeaveEditMode,
  setEditingLeaveId,
  setLeaveModalOpen,
  leaveForm,
}: EditArgs) {
  setLeaveEditMode(true);
  setEditingLeaveId(leave.id);

  leaveForm.setFieldsValue({
    name: leave.name, 
    is_paid: leave.is_paid,
    requires_approval: leave.requires_approval,
    is_active: leave.is_active,
    max_days: Number(leave.max_days ?? 1),
  });

  setLeaveModalOpen(true);
}
