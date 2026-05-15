//src/components/ProtectedRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { Spin } from "antd";

interface Props {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const isAuth = localStorage.getItem("isAuthenticated");
    const role = localStorage.getItem("role");
    const userName = localStorage.getItem("user_name");

    if (!isAuth || !role) {
      setUser(null);
    } else {
      setUser({
        role,
        user_name: userName,
      });
    }

    setLoading(false);
  }, []);

  if (loading) return <Spin fullscreen />;

  if (!user) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;