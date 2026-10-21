import NextLink from "next/link";
import type { ComponentProps, ComponentType } from "react";
import NavigationSignal from "./navigation-signal";

type LinkProps = ComponentProps<typeof NextLink>;
// The App Router build aliases next/link to its app-dir Link, which accepts this
// prop; the package's public types still describe the shared Link that does not.
const AppLink = NextLink as ComponentType<LinkProps & { unstable_dynamicOnHover?: boolean }>;

// Workspace pages render per request, so the default prefetch stops at the layout.
// Fetching the whole page when the pointer or finger arrives makes the click itself
// instant, without paying for a full render of every link that scrolls into view.
export default function Link({ children, ...props }: LinkProps) {
  return <AppLink unstable_dynamicOnHover {...props}><NavigationSignal />{children}</AppLink>;
}
