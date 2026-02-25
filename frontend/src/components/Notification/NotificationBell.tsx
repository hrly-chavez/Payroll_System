import { Badge } from "antd";
import { BellFilled } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import styles from "./Notification.module.css";

type NotificationBellProps = {
  count: number;
};

export default function NotificationBell({ count }: NotificationBellProps) {
  const navigate = useNavigate();

  return (
    <Badge
      count={count}
      size="small"
      offset={[-10, 2]}  
    >
      <BellFilled
        className={styles.bell}
        onClick={() => navigate("/notification")}
      />
    </Badge>
  );
}