import styles from "./CalendarLegendDisplay.module.css";
import { HOLIDAY_LEGEND, PAYROLL_COLOR } from "./CalendarLegend";

export default function CalendarLegendDisplay() {
  return (
    <div className={styles.legendContainer}>
      
      {/* Payroll */}
      <div className={styles.legendItem}>
        <span
          className={styles.colorDot}
          style={{ background: PAYROLL_COLOR.bgColor }}
        />
        <span>Payroll Period</span>
      </div>

      {/* PH Regular */}
      <div className={styles.legendItem}>
        <span
          className={styles.colorDot}
          style={{ background: HOLIDAY_LEGEND.PH.Regular.bgColor }}
        />
        <span>PH Regular Holiday</span>
      </div>

      {/* US Regular */}
      <div className={styles.legendItem}>
        <span
          className={styles.colorDot}
          style={{ background: HOLIDAY_LEGEND.US.Regular.bgColor }}
        />
        <span>US Regular Holiday</span>
      </div>

      {/* Company Holiday */}
      <div className={styles.legendItem}>
        <span
          className={styles.colorDot}
          style={{ background: HOLIDAY_LEGEND.COMPANY["Company Holiday"].bgColor }}
        />
        <span>Company Holiday</span>
      </div>

    </div>
  );
}
