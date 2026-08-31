import Splash from "./splash";

// No metadata export needed: root layout's default title already matches
// what this page would set, and layout.tsx applies a "%s | MECG" template
// to any page-level title override, which would change the visible title.
export default function Home() {
  return <Splash />;
}
