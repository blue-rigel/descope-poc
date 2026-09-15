import { UI_OPTIONS } from "../_lib/constants";
import type { UiOption } from "../_lib/types";

type UiPickerProps = {
  value: UiOption;
  onChange: (option: UiOption) => void;
};

export function UiPicker({ value, onChange }: UiPickerProps) {
  return (
    <div
      className="mx-auto mb-4 flex w-fit rounded-full border bg-background/90 p-1 shadow-sm backdrop-blur"
      aria-label="Login UI options"
    >
      {UI_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${value === option.id
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
            }`}
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
