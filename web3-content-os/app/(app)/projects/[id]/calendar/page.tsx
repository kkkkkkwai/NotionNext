import { ContentCalendar } from '@/components/project/content-calendar'
export const metadata = { title: '内容日历' }
export default function CalendarPage({ params }: { params: { id: string } }) {
  return <ContentCalendar projectId={params.id} />
}
