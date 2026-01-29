import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login/Login";
import Dashboard from "./pages/Employee/Dashboard/Dashboard";

const Router: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/Login" element={<Login />} />
                <Route path="/employee_dashboard" element={<Dashboard />} />
            </Routes>
        </BrowserRouter>
    );
};

export default Router;
