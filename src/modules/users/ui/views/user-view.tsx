import { UserPageLayout } from '@/modules/users/ui/components/user-page-layout'
import { UserSection } from '@/modules/users/ui/sections/user-section'
import { VideosSection } from '@/modules/users/ui/sections/videos-section'

interface UserViewProps {
  userId: string
}

export const UserView = ({ userId }: UserViewProps) => {
  return (
    <UserPageLayout>
      <UserSection userId={userId} />
      <VideosSection userId={userId} />
    </UserPageLayout>
  )
}
