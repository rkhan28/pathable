import { DocumentPage, documentMeta } from "@/components/pages/document-page";

export const generateMetadata = () => documentMeta("contact");

const REPO = process.env.NEXT_PUBLIC_SUPPORT_URL || process.env.NEXT_PUBLIC_REPO_URL;

export default function Page() {
  return (
    <DocumentPage id="contact">
      <ul>
        {REPO && (
          <li>
            <a href={REPO} className="pa-text-link">
              {REPO.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
        <li>
          <a href="https://www.toronto.ca/home/311-toronto-at-your-service/" className="pa-text-link" lang="en">
            Toronto 311
          </a>
        </li>
      </ul>
    </DocumentPage>
  );
}
