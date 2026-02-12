// components/SharedCalendar/CalendarLegend.ts

export type HolidayBase = "PH" | "US" | "COMPANY";

export type HolidayType =
  | "Regular"
  | "Special Non-Working"
  | "Special Working"
  | "Company Holiday";

interface LegendConfig {
  bgColor: string;
  textColor: string;
}

/**
 * Central Holiday Legend Configuration
 * All holiday colors are controlled here
 */
export const HOLIDAY_LEGEND: Record<
  HolidayBase,
  Record<HolidayType, LegendConfig>
> = {
  PH: {
    Regular: {
      bgColor: "#2e7d32",
      textColor: "#ffffff",
    },
    "Special Non-Working": {
      bgColor: "#388e3c",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "#66bb6a",
      textColor: "#000000",
    },
    "Company Holiday": {
      bgColor: "#1b5e20",
      textColor: "#ffffff",
    },
  },

  US: {
    Regular: {
      bgColor: "#c62828",
      textColor: "#ffffff",
    },
    "Special Non-Working": {
      bgColor: "#d32f2f",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "#ef5350",
      textColor: "#ffffff",
    },
    "Company Holiday": {
      bgColor: "#8e0000",
      textColor: "#ffffff",
    },
  },

  COMPANY: {
    Regular: {
      bgColor: "#1565c0",
      textColor: "#ffffff",
    },
    "Special Non-Working": {
      bgColor: "#1976d2",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "#64b5f6",
      textColor: "#000000",
    },
    "Company Holiday": {
      bgColor: "#0d47a1",
      textColor: "#ffffff",
    },
  },
};
