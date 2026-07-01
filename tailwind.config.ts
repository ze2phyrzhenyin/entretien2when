import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-subtle": "hsl(var(--surface-subtle))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        ring: "hsl(var(--ring))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "primary-soft": "hsl(var(--primary-soft))",
        info: "hsl(var(--info))",
        "info-soft": "hsl(var(--info-soft))",
        danger: "hsl(var(--danger))",
        "danger-foreground": "hsl(var(--danger-foreground))",
        "danger-soft": "hsl(var(--danger-soft))",
        success: "hsl(var(--success))",
        "success-soft": "hsl(var(--success-soft))",
        warning: "hsl(var(--warning))",
        "warning-soft": "hsl(var(--warning-soft))",
        locked: "hsl(var(--locked))",
        "locked-soft": "hsl(var(--locked-soft))",
        scheduled: "hsl(var(--scheduled))",
        "scheduled-soft": "hsl(var(--scheduled-soft))"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)"
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        floating: "var(--shadow-floating)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "Noto Sans SC",
          "Microsoft YaHei",
          "Arial",
          "sans-serif"
        ]
      },
      maxWidth: {
        "admin-content": "1440px",
        "candidate-content": "960px"
      },
      transitionDuration: {
        fast: "120ms"
      }
    }
  },
  plugins: []
};

export default config;
