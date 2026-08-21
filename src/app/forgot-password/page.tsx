"use client";
import { useState } from "react";
import PortalShell from "@/components/portal-shell";
import FormField from "@/components/form-field";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);try{const supabase=createClient();await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/auth/callback?next=/reset-password`});setMessage("If that account exists, Supabase sent a password-reset email.");}finally{setBusy(false);}}
  return <PortalShell eyebrow="Account recovery" title="Reset your password." description="Use the email attached to your MECG account."><form onSubmit={submit} className="space-y-4"><FormField label="Email" type="email" required autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)}/>{message&&<p role="status" className="rounded bg-mecg-blue/10 p-3 text-sm">{message}</p>}<button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">{busy?"Sending...":"Send reset email"}</button></form></PortalShell>;
}
