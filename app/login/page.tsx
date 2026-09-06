import { redirect } from "next/navigation";
import { getSessionUser, homePathFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user));

  return (
    <div className="capa-root">
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <div style={{ width: "100%", maxWidth: 460 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div className="capa-tag" style={{ marginBottom: 16 }}>
              QMS · CORRECTIVE &amp; PREVENTIVE ACTION
            </div>
            <div
              className="disp"
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: "var(--navy-deep)",
                letterSpacing: "-0.01em",
              }}
            >
              CAPA Management System
            </div>
            <div
              style={{ color: "var(--ink-muted)", marginTop: 8, fontSize: 14 }}
            >
              Sign in with the account QMD issued for your branch.
            </div>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
