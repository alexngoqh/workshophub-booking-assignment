// Tóm tắt yêu cầu của từng ticket Jira, hiển thị trên terminal và trên màn hình khi demo.
export const STORIES = {
  1: {
    title: 'LATC-1 · Xem danh sách buổi training',
    summary: [
      'Trang chủ hiện tất cả buổi training đã có sẵn.',
      'Mỗi card: tiêu đề, mô tả, ngày giờ, địa điểm, hình thức, "đã đăng ký / sức chứa".',
      'Sắp xếp theo ngày. Hiện "Loading…" khi đang tải, báo lỗi nếu API hỏng.',
    ],
  },
  2: {
    title: 'LATC-2 · Nhân viên đăng ký buổi training',
    summary: [
      'Bấm Register, nhập tên + email, gửi.',
      'Thành công: hiện xác nhận và số người đăng ký tăng 1.',
      'API: 201 thành công · 400 thiếu thông tin · 404 không có session · 409 đã đầy.',
      'Bài lab thêm: một email không được đăng ký 2 lần cho cùng session.',
    ],
  },
  3: {
    title: 'LATC-3 · Danh sách chờ khi session đã đầy',
    summary: [
      'Session đầy thì có nút "Join Waitlist" thay vì từ chối.',
      'Báo rõ là đang chờ (chưa được xác nhận) và vị trí thứ mấy.',
      'API: 202 { status: "waitlisted", position }. Số người đăng ký không đổi.',
    ],
  },
  4: {
    title: 'LATC-4 · Huỷ đăng ký',
    summary: [
      'Người đã đăng ký thấy nút "Cancel Registration".',
      'Có hộp hỏi "Are you sure…?", huỷ xong báo "Your registration has been cancelled".',
      'Số người trên card giảm; nút đổi thành "Cancelled" bị khoá.',
      'API: 200 đã huỷ · 404 không tồn tại · 409 đã huỷ rồi.',
    ],
  },
  5: {
    title: 'LATC-5 · Tự động đẩy người đầu waitlist lên',
    summary: [
      'Khi người đã xác nhận huỷ, người đầu danh sách chờ tự động được chỗ.',
      'Số người đăng ký giữ nguyên (1 người ra, 1 người vào).',
      'Người được đẩy lên reload trang sẽ thấy "Confirmed". Diễn ra trong 1 transaction.',
    ],
  },
  6: {
    title: 'LATC-6 · Organiser xem danh sách đăng ký',
    summary: [
      'Click vào card để mở trang chi tiết (/sessions/:id).',
      'Trang có "Confirmed (N)" và "Waitlist (N)" với tên, email, ngày đăng ký.',
      'Không hiện người đã huỷ. Chưa ai đăng ký → "No registrations yet".',
    ],
  },
  7: {
    title: 'LATC-7 · Hạn chót đăng ký (deadline)',
    summary: [
      'Mỗi session có thể có hạn chót đăng ký.',
      'Trước hạn: "Registration closes: <ngày>". Sau hạn: "Registration closed", không còn nút.',
      'Gửi form sau hạn → báo "Registration for this session has closed" (API 422).',
    ],
  },
  8: {
    title: 'LATC-8 · Thông báo sau khi đăng ký / được đẩy lên',
    summary: [
      'Đăng ký xong: banner "You\'re registered! <tiêu đề> on <ngày>".',
      'Vào waitlist: banner "You\'re on the waitlist for <tiêu đề>…".',
      'Banner tắt được và tự ẩn sau vài giây.',
      'Server ghi log (tuỳ chọn gửi Slack); gửi lỗi cũng không làm hỏng việc đăng ký.',
    ],
  },
  9: {
    title: 'LATC-9 · Nhật ký thay đổi (audit log)',
    summary: [
      'Mọi lần đổi trạng thái đều được ghi lại: đăng ký, vào waitlist, được đẩy lên, huỷ.',
      'Organiser lấy ID đăng ký trên trang chi tiết session, rồi gọi',
      'GET …/registrations/:id/audit để xem lịch sử theo thứ tự. Không sửa/xoá được.',
    ],
  },
}
