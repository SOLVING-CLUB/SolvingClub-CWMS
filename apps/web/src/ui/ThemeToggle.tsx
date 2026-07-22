import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "default"}
      className={compact ? "" : "justify-start"}
      aria-label={`Switch to ${next} theme`}
      onPress={toggleTheme}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      {!compact && <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>}
    </Button>
  );
}
