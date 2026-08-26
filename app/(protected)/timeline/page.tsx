import Editor from "@/lib/editor/app";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Timeline Editor",
  description: "Professional magnetic timeline editor for video sequencing",
};

export default function TimelinePage() {
  return <Editor />;
}
