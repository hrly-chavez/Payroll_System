import { useState, useEffect } from "react";
import EmployeeDetailsModal from "./EmployeeDetailsModal";
import EmployeeSalaryModal from "./EmployeeSalaryModal";
import EmployeeContributionsModal from "./EmployeeContributionsModal";
import EmployeeAllowanceModal from "./EmployeeAllowanceModal";
import EmployeeCredentialsModal from "./EmployeeCredentialsModal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const AddEmployeeFlow: React.FC<Props> = ({ open, onClose }) => {
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
      {/* Step 1: Employee Details (includes Address now) */}
      {step === 1 && (
        <EmployeeDetailsModal
          open={open}
          onNext={(id) => {
            setEmployeeId(id);
            setStep(2);
          }}
          onClose={onClose}
        />
      )}

      {/* Step 2: Salary */}
      {step === 2 && employeeId && (
        <EmployeeSalaryModal
          open
          employeeId={employeeId}
          onNext={() => setStep(3)}
          onClose={onClose}
        />
      )}

      {/* Step 3: Contributions */}
      {step === 3 && employeeId && (
        <EmployeeContributionsModal
          open
          employeeId={employeeId}
          onNext={() => setStep(4)}
          onClose={onClose}
        />
      )}

      {/* Step 4: Allowances */}
      {step === 4 && employeeId && (
        <EmployeeAllowanceModal
          open
          employeeId={employeeId}
          onNext={(creds) => {
            setCredentials(creds);
            setStep(5);
          }}
          onClose={onClose}
        />
      )}

      {/* Step 5: Show credentials */}
      {step === 5 && (
        <EmployeeCredentialsModal
          open
          credentials={credentials}
          onClose={onClose}
        />
      )}
    </>
  );
};

export default AddEmployeeFlow;
