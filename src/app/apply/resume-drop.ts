export type ResumeDrop = { kind: "upload" } | { kind: "ignore" } | { kind: "notice"; message: string };

// What dropping files on the resume zone does. The zone always swallows the
// drop itself, so a PDF never opens in place of the application.
export function resumeDrop(fileCount: number, uploading: boolean): ResumeDrop {
  if (fileCount === 0) return { kind: "ignore" };
  if (uploading) return { kind: "notice", message: "Wait for the current upload to finish." };
  if (fileCount > 1) return { kind: "notice", message: "Drop one PDF at a time." };
  return { kind: "upload" };
}
