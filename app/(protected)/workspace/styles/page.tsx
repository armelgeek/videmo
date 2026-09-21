import { redirect } from 'next/navigation';

/** Styles moved into the brand kit; links and bookmarks still work. */
export default function StylesPage() {
  redirect('/workspace/brand/styles');
}
