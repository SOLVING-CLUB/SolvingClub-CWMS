import { signOut } from "firebase/auth";
import { ShieldAlert } from "lucide-react";
import { fb } from "../firebase";
import { BrandLogo } from "../ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AccessDenied() {
  return <div className="access-denied"><BrandLogo /><Card><CardHeader><span className="empty-icon"><ShieldAlert /></span><CardTitle>Workspace access required</CardTitle></CardHeader><CardContent><p>This account is authenticated but is not an active Solving Club member. Ask an owner to add or reactivate your member record.</p><Button variant="outline" onPress={() => signOut(fb.auth)}>Sign out</Button></CardContent></Card></div>;
}
