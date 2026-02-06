import { NavLink } from "react-router-dom";

import { cn } from "../ui/cn";

const links = [
  { to: "/admin", label: "Candidates" },
  { to: "/admin/questions", label: "Questions" }
];

export default function AdminNav() {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/admin"}
          className={({ isActive }) =>
            cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition",
              isActive
                ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  );
}
