export interface ExcessTimeRequest {
  id: number; // Excess_Time_Request.id
  employee_id: number;
  name: string;

  attendance_id: number;
  attendance_date: string;

  minutes: number;
  start_time: string | null;
  end_time: string | null;

  time_in: string | null;
  time_out: string | null;

  status: "Pending" | "Approved" | "Declined";
  resolution_type: "Overtime" | "Offset" | null;
  remarks: string;
  created_at: string;

  department_name?: string | null;
  shift_name?: string | null;
}

export type PendingExcessTimeResponse = {
  year: number;
  month: number;
  count: number;
  results: Array<{
    id: number;
    minutes: number;
    start_time: string | null;
    end_time: string | null;
    status: "Pending" | "Approved" | "Declined";
    resolution_type: "Overtime" | "Offset" | null;
    remarks: string;
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