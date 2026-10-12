import React from "../react.ts";
import { getHostApi } from "./host.ts";

type Resolver = (hostApi: ReturnType<typeof getHostApi>) => any;

export type HostComponent<Props extends Record<string, unknown>> = ((props: Props) => any) & {displayName: string};

export function createHostComponent<Props extends Record<string, unknown>>(
    displayName: string,
    resolver: Resolver,
): HostComponent<Props> {
    // The SDK loads before the host supplies React. React's forward-ref element
    // shape lets us defer React access until render while retaining refs used by
    // Radix `asChild` triggers, menus, dialogs, and focus restoration.
    const component = {
        $$typeof: Symbol.for("react.forward_ref"),
        displayName,
        render(props: Props, ref: unknown) {
            const Component = resolver(getHostApi());
            if (!Component) throw new Error(`The interface host does not provide ${displayName}. Check minInterfaceVersion.`);
            return (React as any).createElement(Component, {...props, ref});
        },
    };
    return component as unknown as HostComponent<Props>;
}
