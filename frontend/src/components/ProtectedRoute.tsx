//src/components/ProtectedRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Spin } from "antd";
import api from "../api/axios";

interface Props {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ allowedRoles }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const verifyUser = async () => {
      try {
        // Verify using backend cookie auth
        const res = await api.get("/accounts/me/");

        const userData = {
          role: res.data.role,
          user_name: res.data.user_name,
        };

        // Update localStorage safely
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("role", userData.role);
        localStorage.setItem("user_name", userData.user_name);

        setUser(userData);

      } catch (error) {
        // Tokens invalid or expired
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("role");
        localStorage.removeItem("user_name");

        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  if (loading) return <Spin fullscreen />;

  if (!user) return <Navigate to="/" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;