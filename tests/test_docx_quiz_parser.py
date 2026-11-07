import io
import docx
from src.services.docx_quiz_parser import generate_sample_docx_template, parse_docx_quiz


def test_parse_sample_template():
    buf = generate_sample_docx_template()
    result = parse_docx_quiz(buf)
    assert result["total"] == 4
    for q in result["questions"]:
        assert len(q["options"]) == 4
        assert q["correct_answer"] is not None


def test_parse_user_format_with_cau_hoi_and_names():
    user_text = """Câu hỏi 1
Theo lịch sử triết học, triết học ra đời vào khoảng thời gian nào và ở đâu?
*A.Khoảng từ thế kỷ VIII đến thế kỷ VI trước Công nguyên tại các trung tâm văn minh lớn thời cổ đại.
B.Khoảng thế kỷ III sau Công nguyên cùng với sự suy vong của chế độ chiếm hữu nô lệ.
C.Khoảng thế kỷ XIX khi chủ nghĩa tư bản chuyển sang giai đoạn đế quốc chủ nghĩa.
D.Khoảng thế kỷ XV trước Công nguyên ở các nước Tây Âu thời kỳ trung cổ.
Câu hỏi 2
Đâu là những tiền đề khoa học tự nhiên quan trọng cho sự ra đời của triết học Mác vào những năm 40 của thế kỷ XIX?
A.Thuyết tương đối hẹp và thuyết tương đối tổng quát của A. Einstein.
*B.Định luật bảo toàn và chuyển hóa năng lượng, thuyết tế bào, thuyết tiến hóa của C. Darwin.
C.Sự phát triển của cơ học cổ điển Newton trong thế kỷ XVII.
D.Phát hiện ra tia phóng xạ và điện tử vào cuối thế kỷ XIX.
Câu hỏi 3
Thực chất cuộc cách mạng trong triết học do C. Mác và Ph. Ăngghen thực hiện là gì?
*A.Sáng tạo chủ nghĩa duy vật biện chứng, sáng tạo chủ nghĩa duy vật lịch sử và gắn liền triết học với thực tiễn cải tạo thế giới.
B.Tách rời tuyệt đối giữa chủ nghĩa duy vật về tự nhiên với quan niệm duy vật về xã hội.
C.Khôi phục lại hoàn toàn phép biện chứng duy tâm của G.W.F. Hegel.
D.Xây dựng hệ thống triết học tự nhiên đóng vai trò là khoa học của mọi khoa học.
"""
    doc = docx.Document()
    for line in user_text.strip().split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    result = parse_docx_quiz(buf)
    assert result["total"] == 3
    q1 = result["questions"][0]
    assert q1["num"] == 1
    assert "Theo lịch sử triết học" in q1["question_text"]
    assert len(q1["options"]) == 4
    assert q1["correct_letter"] == "A"

    q2 = result["questions"][1]
    assert q2["num"] == 2
    assert len(q2["options"]) == 4
    assert q2["correct_letter"] == "B"

    q3 = result["questions"][2]
    assert q3["num"] == 3
    assert len(q3["options"]) == 4
    assert q3["correct_letter"] == "A"
