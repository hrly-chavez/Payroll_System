//frontend/src/components/Greeting/Greeting.tsx
import React, { useEffect, useState } from "react";
import styles from "./Greeting.module.css";

type StatusType = "NOT_IN" | "IN" | "OUT";

const Greeting: React.FC = () => {
  const name = localStorage.getItem("user_name") || "User";

  const [status, setStatus] = useState<StatusType>("NOT_IN");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const fetchAttendanceStatus = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/attendance/today-status/", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });

        const data = await res.json();

        /*
          Backend should return something like:
          {
            "status": "IN" | "OUT" | "NOT_IN",
            "time": "12:00 AM"
          }
        */

        setStatus(data.status);
        setTime(data.time);
      } catch {
        console.log("Status API not ready yet");
      }
    };

    fetchAttendanceStatus();
  }, []);

  const getStatusLabel = () => {
    switch (status) {
      case "IN":
        return `STATUS : Clocked In (${time})`;
      case "OUT":
        return `STATUS : Clocked Out (${time})`;
      default:
        return "STATUS : Not Clocked In";
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.left}>
        Good to see you, <span className={styles.name}>{name}</span> 
      </div>

      <div className={`${styles.status} ${styles[status]}`}>
        {getStatusLabel()}
      </div>
    </div>
  );
};

export default Greeting;
