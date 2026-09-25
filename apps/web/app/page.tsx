import { redirect } from 'next/navigation';

/** La app abre directamente en el feed, como una experience social. */
export default function HomePage() {
  redirect('/reels');
}
