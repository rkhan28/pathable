import { DocumentPage, documentMeta } from "@/components/pages/document-page";

export const generateMetadata = () => documentMeta("privacy");

export default function Page() {
  return <DocumentPage id="privacy" />;
}
