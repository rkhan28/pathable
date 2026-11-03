"use client";

import dynamic from "next/dynamic";

// "Today" must be the visitor's today, not the build's, so the flow renders on the client.
export const ReportFlowClient = dynamic(() => import("./report-flow").then((m) => m.ReportFlow), { ssr: false });
