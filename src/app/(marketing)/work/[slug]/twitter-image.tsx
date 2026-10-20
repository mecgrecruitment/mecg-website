import ProjectOpenGraphImage from "./opengraph-image";

// Let Next resolve the metadata-file URL, including its generated suffix.
// Hand-written /opengraph-image links can differ from the actual route.
export const dynamic = "force-dynamic";
export const alt = "MECG client case study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default ProjectOpenGraphImage;
