import Image from "next/image";

type GoogleButtonProps = {
  onClick: () => void;
  disabled: boolean;
};

export function GoogleButton({ onClick, disabled }: GoogleButtonProps) {
  return (
    <button
      type="button"
      className="relative flex h-10 w-full items-center justify-center rounded-full border border-[#747775] bg-white px-3 text-sm font-medium leading-5 text-[#1f1f1f] transition-colors hover:bg-[#f8faff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b57d0] disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      <Image
        src="/google-g.svg"
        alt=""
        aria-hidden="true"
        width={18}
        height={18}
        className="absolute left-3 h-[18px] w-[18px]"
      />
      Sign in with Google
    </button>
  );
}
