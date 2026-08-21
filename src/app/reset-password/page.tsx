"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "@/components/portal-shell";
import FormField from "@/components/form-field";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage(){const router=useRouter();const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);try{const supabase=createClient();const {error:updateError}=await supabase.auth.updateUser({password});if(updateError){setError(updateError.message);return;}router.push("/admin/login");}finally{setBusy(false);}}return <PortalShell eyebrow="Account recovery" title="Choose a new password." description="Use at least 12 characters."><form onSubmit={submit} className="space-y-4"><FormField label="New password" type="password" required minLength={12} autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value)}/>{error&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button type="submit" disabled={busy} className="button-primary w-full disabled:opacity-50">{busy?"Updating...":"Update password"}</button></form></PortalShell>}
