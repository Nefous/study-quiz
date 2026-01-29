import { Mail, LogOut, History } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        badge="Profile"
        title="Your account"
        description="Manage your session and view your history."
      />

      <Card variant="elevated" className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
            <BrandLogo size="md" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="text-lg font-semibold text-white">{user?.email ?? ""}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => navigate("/history")}
          >
            <History size={16} />
            View History
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </Button>
        </div>
      </Card>

      <Card variant="subtle" className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Mail size={14} />
          <span>{user?.email ?? ""}</span>
        </div>
        <Link className="text-sm text-indigo-300 hover:text-indigo-200" to="/history">
          Go to History
        </Link>
      </Card>
    </div>
  );
}
