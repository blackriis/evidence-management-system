import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuditLogs from '@/components/admin/audit-logs';

export const metadata: Metadata = {
  title: 'บันทึกการตรวจสอบ - ระบบจัดการหลักฐาน',
  description: 'ดูและจัดการบันทึกการตรวจสอบของระบบ',
};

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Only admins and executives can access audit logs
  if (!['ADMIN', 'EXECUTIVE'].includes(session.user.role)) {
    redirect('/unauthorized');
  }

  return (
    <div className="container mx-auto py-6">
      <AuditLogs />
    </div>
  );
}