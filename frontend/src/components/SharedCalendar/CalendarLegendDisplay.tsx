import styles from "./CalendarLegendDisplay.module.css";
import { HOLIDAY_LEGEND, PAYROLL_COLOR } from "./CalendarLegend";

export default function CalendarLegendDisplay() {
  return (
    <div className={styles.legendWrapper}>

      {/* Payroll on top */}
      <div className={styles.payrollRow}>
        <div className={styles.legendItem}>
          <span
            className={styles.colorDot}
            style={{ background: PAYROLL_COLOR.bgColor }}
          />
          <span>Payroll Period</span>
        </div>
      </div>

      {/* Three column layout */}
      <div className={styles.legendGrid}>

        {/* PH */}
        <div className={styles.legendGroup}>
          <div className={styles.legendTitle}>PH Holidays</div>
          {Object.entries(HOLIDAY_LEGEND.PH).map(([type, config]) => (
            <div key={`PH-${type}`} className={styles.legendItem}>
              <span
                className={styles.colorDot}
                style={{ background: config.bgColor }}
              />
              <span>{type}</span>
            </div>
          ))}
        </div>

        {/* US */}
        <div className={styles.legendGroup}>
          <div className={styles.legendTitle}>US Holidays</div>
          {Object.entries(HOLIDAY_LEGEND.US).map(([type, config]) => (
            <div key={`US-${type}`} className={styles.legendItem}>
              <span
                className={styles.colorDot}
                style={{ background: config.bgColor }}
              />
              <span>{type}</span>
            </div>
          ))}
        </div>

        {/* COMPANY */}
        <div className={styles.legendGroup}>
          <div className={styles.legendTitle}>Company Holidays</div>
          {Object.entries(HOLIDAY_LEGEND.COMPANY).map(([type, config]) => (
            <div key={`COMPANY-${type}`} className={styles.legendItem}>
              <span
                className={styles.colorDot}
                style={{ background: config.bgColor }}
              />
              <span>{type}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
