import { useEffect } from "react";

export default function useNotificationSocket(onNewNotification: () => void) {
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    const wsProtocol =
      window.location.protocol === "https:" ? "wss:" : "ws:";

    const socket = new WebSocket(
      `${wsProtocol}//api.payroll.attitech.ph/ws/notifications/?token=${token}`
    );

    socket.onmessage = () => {
      onNewNotification(); // refresh count when new notification arrives
    };

    socket.onerror = () => {
      console.log("WebSocket error");
    };

    return () => {
      socket.close();
    };
  }, [onNewNotification]);
}
