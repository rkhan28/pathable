import { DocumentPage, documentMeta } from "@/components/pages/document-page";

export const generateMetadata = () => documentMeta("terms");

export default function Page() {
  return <DocumentPage id="terms" />;
}
