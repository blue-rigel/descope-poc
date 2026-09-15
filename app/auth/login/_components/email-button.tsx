type EmailButtonProps = {
  onSend: () => void;
  disabled: boolean;
};

/**
 * Triggers the "continue with email" action, but only after checking the
 * sibling email input's native validity so the Flow never receives a
 * malformed address.
 */
export function EmailButton({ onSend, disabled }: EmailButtonProps) {
  return (
    <button
      type="button"
      className="mx-auto block text-sm underline underline-offset-4 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={(event) => {
        const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>(
          'input[type="email"]',
        );
        if (emailInput?.reportValidity()) {
          onSend();
        }
      }}
      disabled={disabled}
    >
      Send me email
    </button>
  );
}
