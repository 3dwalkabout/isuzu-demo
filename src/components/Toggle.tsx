interface ToggleProps {
  label: string;
  ariaLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, ariaLabel = label, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        onChange={event => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}
