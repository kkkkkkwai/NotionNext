import { ContentCalendar } from '@/components/project/content-calendar'
export const metadata = { title: 'Content Calendar' }
export default function CalendarPage({ params }: { params: { id: string } }) {
  return <ContentCalendar projectId={params.id} />
}
