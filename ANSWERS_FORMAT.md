# Định dạng answers.json

Ứng dụng vẫn hỗ trợ định dạng cũ chỉ gồm các nhóm `abcd`, `ds`, `tln`. Có thể thêm trường `order` để tự quyết định thứ tự câu hỏi và chèn tiêu đề phân khu.

## Ví dụ có thứ tự và tiêu đề tùy chỉnh

```json
{
  "order": [
    { "heading": "Bài 1: Trắc nghiệm" },
    { "type": "abcd", "number": "2" },
    { "type": "abcd", "number": "1" },
    { "type": "ds", "number": "15" },

    { "heading": "Bài 2: Vận dụng" },
    { "type": "tln", "number": "1" },
    { "type": "abcd", "number": "3.1" }
  ],
  "abcd": {
    "1": "a",
    "2": "b",
    "3.1": "d"
  },
  "ds": {
    "15": "dsdd"
  },
  "tln": {
    "1": "12"
  }
}
```

## Cho phép trùng số câu giữa các bài

Nếu hai bài đều có "Câu 1" thuộc cùng dạng `abcd`, hãy dùng `key` riêng để định danh đáp án và `number` để hiển thị số câu:

```json
{
  "order": [
    { "heading": "Bài 1" },
    { "type": "abcd", "key": "bai1-cau1", "number": "1" },

    { "heading": "Bài 2" },
    { "type": "abcd", "key": "bai2-cau1", "number": "1" }
  ],
  "abcd": {
    "bai1-cau1": "a",
    "bai2-cau1": "c"
  }
}
```

- `key` phải duy nhất trong cùng một dạng câu hỏi; đây là mã nội bộ, không hiển thị thành số câu.
- `number` là nhãn hiển thị, có thể trùng giữa các bài.
- Tiến độ và đáp án của hai câu được lưu riêng.
- Cách viết cũ `{ "type": "abcd", "number": "1" }` vẫn được hỗ trợ; khi không có `key`, `number` đồng thời là mã tham chiếu.

## Quy tắc

- `order` được đọc từ trên xuống dưới; ứng dụng không tự sắp xếp lại các mục đã khai báo.
- `{ "heading": "..." }` tạo một tiêu đề phân khu. Tiêu đề áp dụng cho các câu tiếp theo cho đến khi gặp tiêu đề mới.
- `{ "type": "abcd", "number": "2" }` tham chiếu câu 2 trong nhóm `abcd`. `type` nhận một trong ba giá trị `abcd`, `ds`, `tln`.
- `number` nên được ghi dưới dạng chuỗi, kể cả số câu thập phân như `"3.1"`.
- Đáp án đúng vẫn được lưu trong các nhóm `abcd`, `ds`, `tln`; `order` chỉ quyết định cách hiển thị.
- Nếu một câu bị bỏ sót khỏi `order`, ứng dụng tự thêm câu đó vào cuối theo thứ tự mặc định để không làm mất câu hỏi.
- Mục tham chiếu không hợp lệ và mục trùng lặp sẽ bị bỏ qua.
- Không có `order` thì ứng dụng giữ cách đọc cũ: `abcd` → `ds` → `tln`, mỗi nhóm theo số câu tăng dần.
