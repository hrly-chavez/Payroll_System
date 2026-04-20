import { useState, useEffect } from "react";
import { message } from "antd";
import api from "../../../../api/axios";

import EmployeeDetailsModal from "./EmployeeDetailsModal";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import EmployeeContributionsModal from "./EmployeeContributionsModal";
import EmployeeAllowanceModal from "./EmployeeAllowanceModal";
import EmployeeCredentialsModal from "./EmployeeCredentialsModal";

interface Props {
  open: boolean;
  departmentId: number;
  allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[];
  onClose: () => void;
}

const AddEmployeeFlow: React.FC<Props> = ({ open, departmentId, onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const [employeeDetails, setEmployeeDetails] = useState<any>(null);
  const [salaryData, setSalaryData] = useState<any>(null);
  const [contributionsData, setContributionsData] = useState<any[]>([]);
  const [allowancesData, setAllowancesData] = useState<any[]>([]);
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  const [loading, setLoading] = useState(false);

  const currentUserRole = localStorage.getItem("role");

  const allowedRoles: ("EMPLOYEE" | "ADMIN" | "SUPER_ADMIN")[] =
    currentUserRole === "SUPER_ADMIN"
      ? ["ADMIN", "SUPER_ADMIN"]
      : ["EMPLOYEE"];

  // Reset flow when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedRole(null);
      setEmployeeDetails(null);
      setSalaryData(null);
      setContributionsData([]);
      setAllowancesData([]);
      setCredentials({ username: "", password: "" });
      setLoading(false); // reset loading
    }
  }, [open]);

  // -----------------------------
  // FINAL SUBMIT AFTER ALLOWANCES
  // -----------------------------
  const handleFinalSubmit = async (
    finalAllowances: any[] = [],
    roleOverride?: string
  ) => {
    const roleToUse = roleOverride || selectedRole;

    setLoading(true);

    try {
      if (!roleToUse) {
        message.error("Role is missing");
        return;
      }

      const payload = {
        ...employeeDetails,
        role: roleToUse,
        salary: salaryData,
        contributions: contributionsData,
        allowances: finalAllowances,
      };

      console.log("ROLE BEING SENT:", roleToUse);
      console.log("FULL PAYLOAD:", payload);

      const formData = new FormData();

      // ------------------
      // Append basic fields (including nested address)
      // ------------------
      Object.keys(employeeDetails).forEach((key) => {
        const value = employeeDetails[key];

        if (key === "address") {
          Object.keys(value).forEach((addrKey) => {
            const addrValue = value[addrKey];
            if (addrValue !== undefined && addrValue !== null && addrValue !== "undefined") {
              formData.append(`address.${addrKey}`, addrValue);
            }
          });
        } else if (key === "profile_picture") {
          if (value) {
            formData.append("profile_picture", value); // file object
          }
        } else {
          if (value !== undefined && value !== null && value !== "undefined") {
            formData.append(key, value);
          }
        }
      });

      // ------------------
      // Append role
      // ------------------
      formData.append("role", roleToUse);

      // ------------------
      // Append JSON fields as Blobs
      // ------------------
      const normalizedSalary =
        salaryData && !Array.isArray(salaryData)
          ? salaryData
          : salaryData?.[0] || {};

      formData.append("salary", JSON.stringify(normalizedSalary));
      formData.append("contributions", JSON.stringify(contributionsData || []));
      formData.append("allowances", JSON.stringify(finalAllowances || []));

      // ------------------
      // Send POST
      // ------------------
      const res = await api.post("/employees/employees/create-full-employee/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setCredentials({
        username: res.data.username,
        password: res.data.password,
      });

      setStep(6);
    } catch (err: any) {
      message.error(err.response?.data?.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Step 1: Employee Details */}
      {step === 1 && (
        <EmployeeDetailsModal
          open={open}
          departmentId={departmentId}
          allowedRoles={allowedRoles}
          initialValues={employeeDetails}
          onNext={(data) => {
            setEmployeeDetails(data);

            if (data.role === "SUPER_ADMIN") {
              handleFinalSubmit([], data.role); // pass role directly
            } else {
              setSelectedRole(data.role);
              setStep(2);
            }
          }}
          onClose={onClose}
        />
      )}

      {/* Step 2: Salary */}
      {step === 2 && (
        <EmployeeSalaryModal
          open
          initialValues={salaryData}
          onNext={(data) => {
            setSalaryData(data);
            setStep(3);
          }}
          onBack={() => setStep(1)}
          onClose={onClose}
        />
      )}

      {/* Step 3: Contributions */}
      {step === 3 && (
        <EmployeeContributionsModal
          open
          initialValues={contributionsData}
          salaryBase={salaryData?.base_rate}
          payType={salaryData?.pay_type}
          onBack={() => setStep(2)}
          onNext={(data) => {
            setContributionsData(data);
            setStep(4);
          }}
          onClose={onClose}
        />
      )}

      {/* Step 4: Allowances */}
      {step === 4 && (
        <EmployeeAllowanceModal
          open
          initialValues={allowancesData}   // previous data is passed
          onNext={(data) => {
            handleFinalSubmit(data);
          }}
          onBack={() => setStep(3)}
          onClose={onClose}
          loading={loading} // <-- pass loading state to modal
        />
      )}

      {/* Step 5: Credentials (DISPLAY ONLY AFTER FINAL SUBMIT) */}
      {step === 6 && (
        <EmployeeCredentialsModal
          open
          credentials={credentials} // show backend-generated username/password
          onNext={() => {
            setStep(1);
            onClose();
          }}
          onClose={() => {
            setStep(1);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default AddEmployeeFlow;