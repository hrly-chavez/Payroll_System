import React from "react";
import { Button } from "antd";
import { useNavigate } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Button type="primary" onClick={() => navigate("/")}>
        Go to Login
      </Button>
    </div>
  );
};

export default NotFoundPage;