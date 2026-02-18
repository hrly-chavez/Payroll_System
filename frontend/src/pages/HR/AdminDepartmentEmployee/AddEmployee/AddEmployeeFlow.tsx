import { useState, useEffect } from "react";
import EmployeeDetailsModal from "./EmployeeDetailsModal";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import EmployeeContributionsModal from "./EmployeeContributionsModal";
import EmployeeAllowanceModal from "./EmployeeAllowanceModal";
import EmployeeCredentialsModal from "./EmployeeCredentialsModal";

interface Props {
  open: boolean;
  departmentId?: number; // optional if superadmin setup
  onClose: () => void;
  mode?: "ADMIN" | "SUPERADMIN_SETUP"; // default is ADMIN
}

const AddEmployeeFlow: React.FC<Props> = ({ open, departmentId, onClose, mode = "ADMIN" }) => {
  const [step, setStep] = useState(1);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  useEffect(() => {
    if (open) {
      setStep(1);
      setEmployeeId(null);
      setCredentials({ username: "", password: "" });
    }
  }, [open]);

  return (
    <>
      {/* Step 1: Employee Details */}
      {step === 1 && (
        <EmployeeDetailsModal
          open={open}
          departmentId={departmentId || 0} // can pass 0 or undefined for superadmin
          onNext={(id, creds) => {
            setEmployeeId(id);
            setCredentials(creds);
            setStep(mode === "SUPERADMIN_SETUP" ? 2 : 2); // could skip steps if needed
          }}
          onClose={onClose}
          mode={mode}
        />
      )}

      {/* Step 2: Credentials */}
      {step === 2 && (
        <EmployeeCredentialsModal
          open
          credentials={credentials}
          onNext={() => setStep(mode === "SUPERADMIN_SETUP" ? 3 : 3)}
          onClose={onClose}
          mode={mode}
        />
      )}

      {/* Additional steps only for Admin flow */}
      {mode === "ADMIN" && step === 3 && employeeId && (
        <EmployeeSalaryModal
          open
          employeeId={employeeId}
          onNext={() => setStep(4)}
          onClose={onClose}
        />
      )}

      {mode === "ADMIN" && step === 4 && employeeId && (
        <EmployeeContributionsModal
          open
          employeeId={employeeId}
          onNext={() => setStep(5)}
          onClose={onClose}
        />
      )}

      {mode === "ADMIN" && step === 5 && employeeId && (
        <EmployeeAllowanceModal
          open
          employeeId={employeeId}
          onClose={onClose}
          onNext={() => setStep(step + 1)}
        />
      )}
    </>
  );
};


export default AddEmployeeFlow;
