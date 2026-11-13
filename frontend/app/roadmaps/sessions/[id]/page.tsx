import type { Metadata } from "next";
import { AssessmentSessionViewer } from "@/components/roadmaps/assessment-session-viewer";

export const metadata: Metadata = { title: "Saved Assessment — BrainHub" };

export default async function AssessmentSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssessmentSessionViewer sessionId={id} />;
}
