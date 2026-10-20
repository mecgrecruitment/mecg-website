import { display } from "../fonts/display";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} contents`}>{children}</div>;
}
