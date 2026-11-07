"""Module bóc tách và tạo file Word (.docx) cho đề thi trắc nghiệm.

Hỗ trợ các định dạng câu hỏi phổ biến:
- Câu hỏi bắt đầu bằng: 'Câu 1:', 'Câu 1.', 'Question 1:',...
- Phương án bắt đầu bằng: 'A.', 'B.', 'C.', 'D.' hoặc 'a)', 'b)',... (trên cùng dòng hoặc nhiều dòng)
- Nhận diện đáp án đúng:
  + Dấu sao trước chữ cái phương án: '*A.', '*B.'
  + Gạch chân chữ cái phương án trong Word (run.underline)
  + Màu chữ đỏ trong Word (run.font.color)
  + Dòng đáp án riêng bên dưới câu hỏi: 'Đáp án: A'
  + Bảng đáp án ở cuối đề thi: '1. A, 2. B,...' hoặc '1-A 2-B'
- Nhận diện lời giải: 'Lời giải: ...' hoặc 'Giải thích: ...'
"""

from __future__ import annotations

import io
import re
from typing import Any

import docx


def parse_docx_quiz(file_stream: Any, default_title: str = "Đề thi trắc nghiệm") -> dict[str, Any]:
    """Parse luồng file .docx và trả về cấu trúc câu hỏi trắc nghiệm."""
    doc = docx.Document(file_stream)

    # Thu thập tiêu đề từ văn bản (heading đầu tiên nếu có)
    detected_title = None

    parsed_paragraphs = []
    for p in doc.paragraphs:
        p_text = p.text.strip()
        if not p_text:
            continue

        if (
            detected_title is None
            and (
                p.style.name.startswith("Heading")
                or "ĐỀ" in p_text.upper()
                or "KIỂM TRA" in p_text.upper()
                or "THI" in p_text.upper()
            )
            and not re.match(r"^(Câu|Question|Bài|\d+)", p_text, re.IGNORECASE)
        ):
            detected_title = p_text

        runs_info = []
        for r in p.runs:
            r_text = r.text
            is_underline = bool(r.underline)
            is_bold = bool(r.bold)
            color_rgb = None
            if r.font and r.font.color and r.font.color.rgb:
                color_rgb = str(r.font.color.rgb).upper()
            is_red = color_rgb in ("FF0000", "DC2626", "B91C1C", "E11D48")
            runs_info.append({
                "text": r_text,
                "underline": is_underline,
                "bold": is_bold,
                "red": is_red,
            })

        parsed_paragraphs.append({
            "text": p_text,
            "runs": runs_info,
        })

    # Regex patterns
    q_pattern = re.compile(r"^(Câu\s*hỏi|Câu|Question|Bài)?\s*(\d+)[\s.:-]*(.*)$", re.IGNORECASE)
    opt_first_pattern = re.compile(r"^\s*(\*?\s*[A-D]\s*[\.\):])\s*(.*)$", re.IGNORECASE)
    ans_line_pattern = re.compile(r"^(Đáp án|ĐÁP ÁN|Answer|Key)[\s.:-]+([A-D])", re.IGNORECASE)
    exp_pattern = re.compile(r"^(Lời giải|Giải thích|Hướng dẫn giải|Hướng dẫn|HD|Explanation)[\s.:-]+(.*)$", re.IGNORECASE)
    bottom_ans_pattern = re.compile(r"(\d+)[\s.:-]+([A-D])", re.IGNORECASE)

    questions: list[dict[str, Any]] = []
    current_q: dict[str, Any] | None = None
    bottom_answers: dict[int, str] = {}
    is_in_bottom_answers = False
    is_in_guide = False

    def finish_current_question():
        nonlocal current_q
        if current_q:
            opts = current_q["options"]
            # Chỉ coi là câu hỏi hợp lệ nếu có ít nhất 2 options
            if len(opts) >= 2:
                if current_q.get("correct_letter") and not current_q.get("correct_answer"):
                    for opt in opts:
                        if opt.strip().upper().startswith(f"{current_q['correct_letter']}."):
                            current_q["correct_answer"] = opt
                            break
                if not current_q.get("correct_answer") and opts:
                    current_q["correct_answer"] = opts[0]
                    current_q["correct_letter"] = opts[0][0].upper()
                questions.append(current_q)
            current_q = None

    for p in parsed_paragraphs:
        text = p["text"]

        # Bỏ qua phần hướng dẫn quy ước ở đầu file mẫu (nếu có)
        if "HƯỚNG DẪN" in text.upper():
            is_in_guide = True
            continue
        if is_in_guide:
            if "—" in text or "-" * 5 in text:
                is_in_guide = False
            continue

        # Kiểm tra phần bảng đáp án cuối trang
        if re.search(r"^(BẢNG ĐÁP ÁN|ĐÁP ÁN CÁC CÂU|ANSWER KEY)", text, re.IGNORECASE):
            finish_current_question()
            is_in_bottom_answers = True
            continue

        if is_in_bottom_answers:
            matches = bottom_ans_pattern.findall(text)
            for num_str, ans_letter in matches:
                bottom_answers[int(num_str)] = ans_letter.upper()
            continue

        # Kiểm tra Lời giải
        exp_match = exp_pattern.match(text)
        if exp_match and current_q is not None:
            current_q["explanation"] = exp_match.group(2).strip() or text
            continue

        # Kiểm tra Dòng đáp án riêng
        ans_match = ans_line_pattern.match(text)
        if ans_match and current_q is not None:
            correct_letter = ans_match.group(2).upper()
            current_q["correct_letter"] = correct_letter
            continue

        # Kiểm tra Bắt đầu câu hỏi mới
        is_option_line = bool(opt_first_pattern.match(text))
        q_match = q_pattern.match(text)

        if q_match and not is_option_line and (q_match.group(1) or int(q_match.group(2)) == len(questions) + 1):
            finish_current_question()
            q_num = int(q_match.group(2))
            q_body = q_match.group(3).strip()
            current_q = {
                "num": q_num,
                "question_text": q_body,
                "options": [],
                "options_raw": [],
                "correct_answer": None,
                "correct_letter": None,
                "explanation": "",
            }
            continue

        # Kiểm tra các phương án A, B, C, D
        if current_q is not None:
            if is_option_line:
                raw_matches = list(re.finditer(r"(?:^|[\t]| {2,}|;\s*)(\*?\s*[A-D]\s*[\.\):])\s*", text, re.IGNORECASE))
                valid_options = []
                prev_letter = None
                for m in raw_matches:
                    marker = m.group(1).strip()
                    clean = marker.replace("*", "").strip()
                    letter = clean[0].upper()
                    if prev_letter is None:
                        valid_options.append((m.start(1), m.end(), marker, letter))
                        prev_letter = letter
                    else:
                        if ord(letter) == ord(prev_letter) + 1:
                            valid_options.append((m.start(1), m.end(), marker, letter))
                            prev_letter = letter

                for i in range(len(valid_options)):
                    start_idx, end_idx, marker, letter = valid_options[i]
                    next_start = valid_options[i + 1][0] if i + 1 < len(valid_options) else len(text)
                    opt_val = text[end_idx:next_start].strip()

                    is_correct = False
                    if "*" in marker:
                        is_correct = True

                    # Kiểm tra gạch chân hoặc màu đỏ trong run
                    for r in p["runs"]:
                        if letter in r["text"] or (opt_val and opt_val[:5] in r["text"]):
                            if r["underline"] or r["red"]:
                                is_correct = True
                                break

                    full_opt_text = f"{letter}. {opt_val}" if not opt_val.startswith(f"{letter}.") else opt_val
                    current_q["options"].append(full_opt_text)
                    current_q["options_raw"].append((letter, opt_val))
                    if is_correct:
                        current_q["correct_answer"] = full_opt_text
                        current_q["correct_letter"] = letter
                continue

            # Nếu là dòng tiếp nối của câu hỏi
            if not current_q["options"]:
                if not current_q["question_text"]:
                    current_q["question_text"] = text
                else:
                    current_q["question_text"] += "\n" + text
            elif current_q["options"]:
                # Là nội dung tiếp nối của lời giải
                if not current_q["explanation"]:
                    current_q["explanation"] = text
                else:
                    current_q["explanation"] += "\n" + text

    finish_current_question()

    # Bổ sung đáp án từ bảng đáp án cuối trang nếu có
    if bottom_answers:
        for q in questions:
            num = q.get("num")
            if num in bottom_answers:
                correct_letter = bottom_answers[num]
                q["correct_letter"] = correct_letter
                for opt in q["options"]:
                    if opt.strip().upper().startswith(f"{correct_letter}."):
                        q["correct_answer"] = opt
                        break

    final_title = (detected_title or default_title).strip()
    return {
        "title": final_title,
        "total": len(questions),
        "questions": questions,
    }


def generate_sample_docx_template() -> io.BytesIO:
    """Tạo file Word (.docx) mẫu chuẩn theo quy ước để người dùng tải về tham khảo."""
    doc = docx.Document()

    # Tiêu đề tài liệu
    title_p = doc.add_paragraph()
    r_title = title_p.add_run("BỘ ĐỀ THI TRẮC NGHIỆM MẪU CHUẨN")
    r_title.bold = True
    r_title.font.size = docx.shared.Pt(16)
    title_p.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER

    sub_p = doc.add_paragraph("Mẫu soạn thảo đề thi trắc nghiệm tự động nhận diện trên hệ thống StudyMind")
    sub_p.alignment = docx.enum.text.WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()

    # Hướng dẫn quy ước
    guide_p = doc.add_paragraph()
    r_g = guide_p.add_run("📌 HƯỚNG DẪN QUY ƯỚC SOẠN THẢO:")
    r_g.bold = True
    doc.add_paragraph("• Mỗi câu hỏi bắt đầu bằng: 'Câu 1:', 'Câu 2:',... hoặc 'Bài 1:', '1.'")
    doc.add_paragraph("• Mỗi phương án bắt đầu bằng: 'A.', 'B.', 'C.', 'D.'")
    doc.add_paragraph("• Cách đánh dấu đáp án ĐÚNG (chọn 1 trong 3 cách sau):")
    doc.add_paragraph("   - Cách 1 (Khuyên dùng): Thêm dấu * trước chữ cái đáp án đúng (Ví dụ: *A. hoặc *B.)")
    doc.add_paragraph("   - Cách 2: Gạch chân (Underline) hoặc tô đỏ chữ cái phương án đúng.")
    doc.add_paragraph("   - Cách 3: Thêm dòng riêng 'Đáp án: A' ngay dưới các phương án, hoặc để bảng đáp án ở cuối đề.")
    doc.add_paragraph("• Lời giải / Giải thích chi tiết (tùy chọn): Dòng bắt đầu bằng 'Lời giải: ...' hoặc 'Giải thích: ...'")

    doc.add_paragraph("—" * 35)

    # Các câu hỏi mẫu
    # Câu 1: Dùng dấu *
    doc.add_paragraph("Câu 1: Trong ngôn ngữ Dart, từ khóa nào dùng để khai báo một biến chỉ gán giá trị một lần duy nhất tại runtime?")
    doc.add_paragraph("*A. final")
    doc.add_paragraph("B. const")
    doc.add_paragraph("C. var")
    doc.add_paragraph("D. dynamic")
    doc.add_paragraph("Lời giải: final chỉ được gán giá trị 1 lần tại thời điểm runtime, trong khi const là hằng số compile-time.")

    # Câu 2: Gạch chân
    doc.add_paragraph("Câu 2: Hàm nào là điểm bắt đầu thực thi (entry point) của mọi ứng dụng Dart và Flutter?")
    p_opt = doc.add_paragraph()
    p_opt.add_run("A. start()          ")
    r_b = p_opt.add_run("B. main()")
    r_b.underline = True
    p_opt.add_run("          C. run()          D. init()")
    doc.add_paragraph("Lời giải: Hàm main() là hàm khởi chạy chính của chương trình.")

    # Câu 3: Dòng Đáp án riêng
    doc.add_paragraph("Câu 3: Đâu là widget cơ bản nhất dùng để hiển thị văn bản trên giao diện Flutter?")
    doc.add_paragraph("A. Container")
    doc.add_paragraph("B. Image")
    doc.add_paragraph("C. Text")
    doc.add_paragraph("D. Scaffold")
    doc.add_paragraph("Đáp án: C")
    doc.add_paragraph("Giải thích: Widget Text được dùng để hiển thị chuỗi văn bản đơn giản kèm theo định dạng font, màu sắc.")

    # Câu 4: Dấu *
    doc.add_paragraph("Câu 4: Lệnh nào sau đây dùng để cài đặt thư viện phụ thuộc trong dự án Flutter?")
    doc.add_paragraph("A. flutter build")
    doc.add_paragraph("*B. flutter pub get")
    doc.add_paragraph("C. flutter run")
    doc.add_paragraph("D. flutter test")

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf
