//src/components/bottomBar/saveButton
//
//Button object for innitiating a trasncript save from chat bubbles to transcripts library, called bu BottomBar.

import { SaveIcon } from "~/components/icons";

type SaveButtonProps = {
  onClick: () => void;
  theme: "light" | "dark";
};

export function SaveButton({ onClick, theme }: SaveButtonProps) {
  return (
    <button onClick={onClick}>
      <SaveIcon
        className={`h-7 w-7 ${theme === "dark" ? "text-foreground" : "text-foreground"}`}
      />
    </button>
  );
}
