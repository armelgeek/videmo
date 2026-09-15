export function NotebookBackground() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none opacity-5"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="notebook" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#notebook)" />
    </svg>
  );
}
