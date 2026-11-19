type QuantityFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export default function QuantityField({
  label,
  value,
  min,
  max,
  disabled = false,
  onChange,
}: QuantityFieldProps) {
  return (
    <div className="flex items-center justify-between py-4.75 text-sm font-extrabold">
      <span>{label}</span>
      <div className="flex items-center overflow-hidden rounded-lg border border-line">
        <button
          type="button"
          className="h-10 w-10.5 bg-white text-xl disabled:opacity-55"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min || disabled}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output className="min-w-9 text-center font-mono" aria-label={label} aria-live="polite" aria-atomic="true">
          {value}
        </output>
        <button
          type="button"
          className="h-10 w-10.5 bg-white text-xl disabled:opacity-55"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max || disabled}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
