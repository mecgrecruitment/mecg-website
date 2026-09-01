import { ImageResponse } from "next/og";
import { getPublicProject, getPublicProjectSlugs } from "@/lib/projects/public-projects";

export const alt = "MECG client case study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateImageMetadata() {
  return (await getPublicProjectSlugs()).map((slug) => ({ id: slug }));
}

export default async function ProjectOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getPublicProject(slug);

  return new ImageResponse(
    <div style={{ alignItems: "center", background: "#070d1f", color: "white", display: "flex", height: "100%", padding: "80px", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
        <div style={{ color: "#fe904d", fontSize: 30, fontWeight: 700 }}>{project ? `${project.industry} · ${project.semester}` : "MECG"}</div>
        <div style={{ fontSize: 66, fontWeight: 700, letterSpacing: "-3px", lineHeight: 1.08, marginTop: 28 }}>{project?.title ?? "Michigan Engineering Consulting Group"}</div>
        <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 28, marginTop: 34 }}>{project?.decision ?? "Pro-bono consulting at the University of Michigan"}</div>
      </div>
    </div>,
    size,
  );
}
