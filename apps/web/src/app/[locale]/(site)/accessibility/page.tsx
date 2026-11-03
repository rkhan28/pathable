import { DocumentPage, documentMeta } from "@/components/pages/document-page";

export const generateMetadata = () => documentMeta("accessibility");

export default function Page() {
  return <DocumentPage id="accessibility" />;
}
