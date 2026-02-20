export function showBackendError(err: any, form: any, fieldMap?: Record<string, string>) {
  const data = err?.response?.data;

  if (!data) {
    return { toast: "Network error or server is unreachable.", applied: false };
  }

  // string response
  if (typeof data === "string") {
    return { toast: data, applied: false };
  }

  // { detail: "..." }
  if (typeof data?.detail === "string") {
    return { toast: data.detail, applied: false };
  }

  // DRF field errors object
  if (typeof data === "object") {
    const formErrors: { name: string; errors: string[] }[] = [];
    let nonField: string[] = [];

    Object.entries(data).forEach(([key, val]) => {
      const msgs = Array.isArray(val) ? val.map(String) : [String(val)];
      if (key === "non_field_errors") {
        nonField = msgs;
        return;
      }

      const mapped = fieldMap?.[key] || key;
      formErrors.push({ name: mapped, errors: msgs });
    });

    if (formErrors.length) {
      form.setFields(formErrors);
    }

    if (nonField.length) {
      return { toast: nonField.join(" "), applied: true };
    }

    // if field errors exist, show first field error as toast too
    if (formErrors.length) {
      const first = formErrors[0]?.errors?.[0] || "Please fix the highlighted fields.";
      return { toast: first, applied: true };
    }
  }

  return { toast: "Something went wrong.", applied: false };
}
