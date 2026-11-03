import { DocumentPage, documentMeta } from "@/components/pages/document-page";

export const generateMetadata = () => documentMeta("ai");

export default function Page() {
  return <DocumentPage id="ai" />;
}
