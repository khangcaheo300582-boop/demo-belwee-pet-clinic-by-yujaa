// app/api/lay-lich-su/route.ts
// API: Lấy danh sách lịch sử đặt lịch theo email khách hàng
// FIXED: Pagination support, optimized read, proper error handling

import { NextResponse } from 'next/server';
import { dbBooking } from '@/lib/dbBooking';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/authOptions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get('page');
  const limitParam = searchParams.get('limit');

  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.toLowerCase().trim();
  if (!sessionEmail) {
    return NextResponse.json({ message: 'Vui lòng đăng nhập để xem lịch sử đặt lịch.' }, { status: 401 });
  }

  try {
    const page = pageParam ? parseInt(pageParam, 10) : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const { bookings, total } = await dbBooking.findByEmail(sessionEmail, { page, limit });

    // Map to frontend format
    const mappedList = bookings.map(item => ({
      id: item.id,
      title: item.serviceType,
      petName: item.petName,
      petType: item.petType,
      time: item.time,
      notes: item.notes,
      addressName: item.addressName,
      status: item.status,
      createdAt: item.createdAt,
      confirmedAt: item.confirmedAt,
    }));

    const totalPages = limit ? Math.ceil(total / limit) : 1;

    return NextResponse.json({
      appointments: mappedList,
      total,
      page: page || 1,
      totalPages,
    }, { status: 200 });
  } catch (error) {
    console.error('Lỗi lấy lịch sử:', error);
    return NextResponse.json({ appointments: [], total: 0, page: 1, totalPages: 0 }, { status: 500 });
  }
}
