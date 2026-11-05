# Định dạng answers.json

Mỗi đề dùng một **mảng lớn**, bên trong là các mảng con. Mỗi mảng con đại diện cho một bài hoặc một phần. Ứng dụng đọc đúng thứ tự từ trên xuống dưới, không tự sắp xếp câu hỏi.

## Cấu trúc

```json
[
  ["Bài 1: Nhận biết",
    ["abcd", "1", "a"],
    ["abcd", "2", "c"],
    ["ds", "15", "dsdd"]
  ],
  ["Bài 2: Vận dụng",
    ["tln", "1", "12"],
    ["abcd", "1", "b"]
  ],
  [
    ["abcd", "a"],
    ["abcd", "d"]
  ]
]
```

## Quy tắc

- Mỗi mảng con là một bài/phần độc lập.
- Nếu phần tử đầu tiên của mảng con là chuỗi, chuỗi đó là tiêu đề. Nếu phần tử đầu tiên là một mảng câu hỏi thì phần đó không có tiêu đề.
- Mỗi câu hỏi có thể viết theo một trong hai dạng:
  - `["abcd", "1", "a"]`: loại câu hỏi, số câu hiển thị, đáp án.
  - `["abcd", "a"]`: loại câu hỏi, đáp án; ứng dụng tự đánh số theo vị trí trong phần.
- `type` chỉ nhận `abcd`, `ds`, `tln`.
- Với `abcd`, đáp án là `a`, `b`, `c` hoặc `d`.
- Với `ds`, đáp án gồm bốn ký tự `d` hoặc `s`, ví dụ `"dsds"`.
- Với `tln`, đáp án là chuỗi số, ví dụ `"12"` hoặc `"13,3"`.
- Nên ghi đáp án và số câu dưới dạng chuỗi để tránh mất định dạng.
- Số câu được phép trùng giữa các phần. Mỗi câu có ID nội bộ riêng theo vị trí trong mảng, nên đáp án và tiến độ không bị ghi đè.
- Có thể trộn `abcd`, `ds`, `tln` tự do trong cùng một phần.
- Không bắt buộc phải có tiêu đề. Có thể khai báo số câu tường minh nếu số câu trên PDF không bắt đầu từ 1.

## Ví dụ tối giản

```json
[
  ["Bài 1", ["abcd", "1", "a"], ["ds", "2", "dsds"]],
  ["Bài 2", ["abcd", "1", "c"]]
]
```
