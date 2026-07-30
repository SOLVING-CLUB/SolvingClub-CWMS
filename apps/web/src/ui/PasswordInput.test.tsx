import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./PasswordInput";

// globals: false, so RTL's auto-cleanup never registers itself.
afterEach(cleanup);

function toggle() {
  return screen.getByRole("button", { name: /password/i });
}

describe("PasswordInput", () => {
  it("starts masked and offers to show the password", () => {
    render(<PasswordInput id="pw" aria-label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
    expect(toggle()).toHaveProperty("ariaLabel", "Show password");
  });

  it("reveals and re-masks the value on toggle", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" aria-label="Password" />);

    await user.click(toggle());
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "text");
    expect(toggle()).toHaveProperty("ariaLabel", "Hide password");

    await user.click(toggle());
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
    expect(toggle()).toHaveProperty("ariaLabel", "Show password");
  });

  it("keeps the typed value intact across a reveal", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" aria-label="Password" />);

    await user.type(screen.getByLabelText("Password"), "s3cret-value");
    await user.click(toggle());

    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.value).toBe("s3cret-value");
  });

  it("points the toggle at the field it controls", () => {
    render(<PasswordInput id="member-password" aria-label="Password" />);
    expect(toggle().getAttribute("aria-controls")).toBe("member-password");
  });

  it("cannot be revealed while the form is submitting", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="pw" aria-label="Password" toggleDisabled />);

    await user.click(toggle());
    expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
  });
});
