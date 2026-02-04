// frontend/src/pages/Unauthorized/Unauthorized.tsx
import React from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>🚫 Unauthorized</h1>

      <p style={{ fontSize: "18px", marginBottom: "24px", color: "#555" }}>
        You are not authorized to access this page.
      </p>

      <Button type="primary" onClick={() => navigate(-1)}>
        Go Back
      </Button>
    </div>
  );
};

export default Unauthorized;
