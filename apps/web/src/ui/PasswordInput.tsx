import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";

type PasswordInputProps = Omit<React.ComponentProps<typeof InputGroupInput>, "type"> & {
  /** Hides the reveal control (e.g. while a form is submitting). */
  toggleDisabled?: boolean;
};

/**
 * Password field with a reveal toggle. Visibility is local state that always
 * starts hidden, so a revealed password never survives a remount (sign-out,
 * dialog close, switching between create and reset modes).
 */
export function PasswordInput({ toggleDisabled, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  return (
    <InputGroup>
      <InputGroupInput {...props} id={inputId} type={visible ? "text" : "password"} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-controls={inputId}
          isDisabled={toggleDisabled || props.disabled}
          onPress={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
