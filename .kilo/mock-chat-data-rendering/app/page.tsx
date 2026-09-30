import { ChatShowcase, type ShowcaseData } from '@/components/chat/chat-showcase'
import showcaseData from '@/data/chat-showcase.json'

export default function Page() {
  return <ChatShowcase data={showcaseData as ShowcaseData} />
}
