import React from "react";
import { useSelector } from "react-redux";
import { selectAssociationOptions } from "../features/associations/associationSelectors";

function AssociationSelect({
  value,
  onChange,
  label = "Association",
  placeholder = "Choisir une association",
  disabled = false,
}) {
  const options = useSelector(selectAssociationOptions);

  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>

      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        style={{
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: disabled ? "#f8fafc" : "#fff",
        }}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default AssociationSelect;