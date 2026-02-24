//src/pages/SuperAdmin/Dashboard/types.ts
export interface OverTimeRequest {
  id: number; // Attendance_Event.id
  employee_id: number;
  name: string;

  attendance_id: number;
  attendance_date: string;

   type: string; 

  minutes: number;
  start_time: string | null;
  end_time: string | null;

  time_in: string | null;
  time_out: string | null;

  status: "Pending" | "Approved" | "Declined";
  event_remarks: string;

  department_name?: string | null;
  shift_name?: string | null;
}

export type PendingOTResponse = {
  year: number;
  month: number;
  count: number;
  results: Array<{
    id: number;
    type: string;
    minutes: number;
    start_time: string | null;
    end_time: string | null;
    approval_status: "Pending" | "Approved" | "Declined";
    event_remarks: string;
    created_at: string;

    attendance_id: number;
    attendance_date: string;
    time_in: string | null;
    time_out: string | null;

    employee_id: number;
    full_name: string;
    department_name: string | null;
    shift_name: string | null;
  }>;
};