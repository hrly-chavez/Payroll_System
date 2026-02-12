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
export const PAYROLL_COLOR = {
  bgColor: "#D6F2EA",
  textColor: "#000000",
};

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
      bgColor: "linear-gradient(135deg, #ab0202, #2e7d32)",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "linear-gradient(135deg, #2e7d32, #ffde3b)",
      textColor: "#000000",
    },
    "Company Holiday": {
      bgColor: "#386FA4",
      textColor: "#ffffff",
    },
  },

  US: {
    Regular: {
      bgColor: "#ab0202",
      textColor: "#ffffff",
    },
    "Special Non-Working": {
      bgColor: "linear-gradient(135deg, #ab0202, #2e7d32)",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "linear-gradient(135deg, #ab0202, #ffde3b)",
      textColor: "#ffffff",
    },
    "Company Holiday": {
      bgColor: "#386FA4",
      textColor: "#ffffff",
    },
  },

  COMPANY: {
    Regular: {
      bgColor: "#386FA4",
      textColor: "#ffffff",
    },
    "Special Non-Working": {
      bgColor: "linear-gradient(135deg, #ab0202, #2e7d32)",
      textColor: "#ffffff",
    },
    "Special Working": {
      bgColor: "linear-gradient(135deg, #2e7d32, #ffde3b)",
      textColor: "#000000",
    },
    "Company Holiday": {
      bgColor: "#386FA4",
      textColor: "#ffffff",
    },
  },
};
