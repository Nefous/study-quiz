import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import Background from "./Background";
import Badge from "../ui/Badge";
import Button from "../ui/Button";

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen text-slate-100">
      <Background />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Python Interview Prep
          </Link>
          <div className="flex items-center gap-3">
            <Badge tone="neutral" className="bg-white/10 text-white">
              Beta
            </Badge>
            <Button
              variant="ghost"
              className="border border-white/10 text-white hover:bg-white/10"
              onClick={() => window.open("https://github.com/Nefous/study-quiz", "_blank")}
            >
              GitHub
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
