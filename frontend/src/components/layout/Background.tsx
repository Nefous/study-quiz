export default function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient - more subtle */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950" />
      
      {/* Top radial highlight - very subtle */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08),_transparent_50%)]" />
      
      {/* Grid pattern - more subtle with smaller size */}
      <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:32px_32px]" />
      
      {/* Accent orbs - more subtle */}
      <div className="absolute -top-48 right-1/4 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px]" />
      <div className="absolute top-1/3 -left-24 h-64 w-64 rounded-full bg-purple-500/8 blur-[80px]" />
      <div className="absolute -bottom-32 right-1/3 h-72 w-72 rounded-full bg-cyan-400/5 blur-[90px]" />
      
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] [background-image:url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIvPjwvc3ZnPg==')]" />
    </div>
  );
}
