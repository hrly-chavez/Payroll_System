//frontend/src/pages/helpers.tsx

/**
 * Converts backend time string (HH:MM:SS or HH:MM:SS.microseconds)
 * into a readable 12-hour time format (e.g. 2:13 AM).
 *
 * Used for displaying time_in / time_out values returned by the backend.
 */
export const formatBackendTime = (value: string | null): string => {
  if (!value) return "";

  // Case A: ISO datetime string (DateTimeField output), ex: 2026-02-23T07:58:00+08:00
  if (value.includes("T")) {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // Case B: time-only string (TimeField output), ex: 02:13:42 or 02:13:42.183639
  const cleanTime = value.split(".")[0]; // strip microseconds
  const [hoursStr, minutesStr, secondsStr] = cleanTime.split(":");

  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const seconds = Number(secondsStr || "0");

  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return "";

  const d = new Date();
  d.setHours(hours, minutes, seconds, 0);

  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};



/**
 * Formats a Date object into a readable time string
 * based on a specific timezone.
 *
 * Used for live clock display (PH Time, USA Time).
 */
export const formatTime = (date: Date | null, tz: string): string => {
  if (!date) return "--:--:--";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
    timeZone: tz,
  }).format(date);
};



/**
 * Represents the possible attendance states for a day.
 */
export type AttendanceStatusKey = "NOT_IN" | "IN" | "OUT";

type AttendanceLike = {
  time_in: string | null;
  time_out: string | null;
};



/**
 * Determines the attendance status based on time_in and time_out.
 *
 * - NOT_IN → no punch in yet
 * - IN     → punched in but not punched out
 * - OUT    → punched in and punched out
 */
export const getAttendanceStatusKey = (
  attendance: AttendanceLike | null
): AttendanceStatusKey => {
  if (!attendance?.time_in) return "NOT_IN";
  if (attendance.time_out) return "OUT";
  return "IN";
};



/**
 * Builds a user-friendly attendance status label
 * (e.g. "STATUS : Clocked In (2:13 AM)").
 *
 * Returns both:
 * - key   → for UI styling (color badge)
 * - label → for display text
 */
export const getAttendanceStatusLabel = (
  attendance: AttendanceLike | null,
  formatBackendTimeFn: (t: string | null) => string
): { key: AttendanceStatusKey; label: string } => {
  const key = getAttendanceStatusKey(attendance);

  if (key === "IN") {
    const t = formatBackendTimeFn(attendance?.time_in ?? null);
    return { key, label: `STATUS : Clocked In (${t})` };
  }

  if (key === "OUT") {
    const t = formatBackendTimeFn(attendance?.time_out ?? null);
    return { key, label: `STATUS : Clocked Out (${t})` };
  }

  return { key, label: "STATUS : Not Clocked In" };
};
