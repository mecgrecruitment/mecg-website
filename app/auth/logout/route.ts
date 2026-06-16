import { logout } from "../actions";

export async function GET() {
  await logout();
}
