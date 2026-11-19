import { useId, type TextareaHTMLAttributes } from "react";

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export default function TextareaField({
  label,
  hint,
  id,
  ...textareaProps
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <>
      <label
        className="mt-6 mb-2 block text-sm font-extrabold"
        htmlFor={fieldId}
      >
        {label}{" "}
        {hint && (
          <span className="text-xs font-normal text-secondary">{hint}</span>
        )}
      </label>
      <textarea
        id={fieldId}
        className="block w-full resize-y rounded-lg border border-[#a9a49b] bg-white p-3 text-sm"
        {...textareaProps}
      />
    </>
  );
}
