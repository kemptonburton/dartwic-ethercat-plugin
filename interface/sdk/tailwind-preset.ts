import tailwindcssAnimate from "tailwindcss-animate";

/** Tailwind preset containing DARTWIC semantic colors, typography, and animation tokens. @dartwic-reference @category Styling */
export const dartwicTailwindPreset = {
    darkMode: ["class"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["var(--font-interface)"],
                mono: ["var(--font-interface)"],
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                red: {
                    DEFAULT: "var(--red)",
                    foreground: "var(--red-foreground)",
                    muted: "var(--red-muted)",
                    border: "var(--red-border)",
                },
                green: {
                    DEFAULT: "var(--green)",
                    foreground: "var(--green-foreground)",
                    muted: "var(--green-muted)",
                    border: "var(--green-border)",
                },
                yellow: {
                    DEFAULT: "var(--yellow)",
                    foreground: "var(--yellow-foreground)",
                    muted: "var(--yellow-muted)",
                    border: "var(--yellow-border)",
                },
                blue: {
                    DEFAULT: "var(--blue)",
                    foreground: "var(--blue-foreground)",
                    muted: "var(--blue-muted)",
                    border: "var(--blue-border)",
                },
                gray: {
                    DEFAULT: "var(--gray)",
                    foreground: "var(--gray-foreground)",
                    muted: "var(--gray-muted)",
                    border: "var(--gray-border)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)"
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)"
                },
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)"
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)"
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)"
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)"
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)"
                },
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                chart: {
                    "1": "var(--chart-1)",
                    "2": "var(--chart-2)",
                    "3": "var(--chart-3)",
                    "4": "var(--chart-4)",
                    "5": "var(--chart-5)",
                },
                sidebar: {
                    DEFAULT: "var(--sidebar-background)",
                    foreground: "var(--sidebar-foreground)",
                    primary: "var(--sidebar-primary)",
                    "primary-foreground": "var(--sidebar-primary-foreground)",
                    accent: "var(--sidebar-accent)",
                    "accent-foreground": "var(--sidebar-accent-foreground)",
                    border: "var(--sidebar-border)",
                    ring: "var(--sidebar-ring)",
                },
                schematic: {
                    background: "var(--schematic-background)",
                    grid: "var(--schematic-grid)",
                    "node-outline": "var(--schematic-node-outline)",
                    edge: "var(--schematic-edge)",
                    "label-color": "var(--schematic-label-color)",
                    "node-accent": "var(--schematic-node-accent)",
                },
                editor: {
                    background: "var(--editor-background)",
                    selection: "var(--editor-selection)",
                    link: "var(--editor-link)",
                    "link-hover": "var(--editor-link-hover)",
                    "token-accent": "var(--editor-token-accent)",
                },
                graph: {
                    grid: "var(--graph-grid)",
                    crosshair: "var(--graph-crosshair)",
                    line: "var(--graph-line)",
                    "line-muted": "var(--graph-line-muted)",
                    "line-strong": "var(--graph-line-strong)",
                },
                console: {
                    error: "var(--console-error)",
                    background: "var(--console-background)",
                },
                taars: {
                    "main-color": "var(--taars-main-color)",
                }
            },
            keyframes: {
                "accordion-down": {
                    from: {
                        height: "0"
                    },
                    to: {
                        height: "var(--radix-accordion-content-height)"
                    }
                },
                "accordion-up": {
                    from: {
                        height: "var(--radix-accordion-content-height)"
                    },
                    to: {
                        height: "0"
                    }
                }
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            }
        }
    },
    plugins: [tailwindcssAnimate],
};

export default dartwicTailwindPreset;
